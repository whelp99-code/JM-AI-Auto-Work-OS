import ActionHubCore
import Foundation
import UIKit

@MainActor
final class AppModel: ObservableObject {
  enum ConnectionState: Equatable {
    case loading
    case disconnected
    case connected(deviceName: String)
    case failed(String)
  }

  @Published private(set) var connectionState: ConnectionState = .loading
  @Published private(set) var dashboard: MobileDashboard?
  @Published private(set) var reviewPlans: [ActionPlan] = []
  @Published private(set) var activity: [ActivityItem] = []
  @Published private(set) var pendingCaptureCount = 0
  @Published var notificationPreferences = NotificationPreferences()
  @Published var isRefreshing = false
  @Published var lastError: String?
  @Published var selectedTab: AppTab = .today
  @Published var presentedPlanId: String?
  @Published var reviewNavigationPath: [String] = []
  @Published var isCapturePresented = false
  @Published private(set) var pendingPairingPayload: String?

  let biometricLock = BiometricLock()
  private let credentialStore = KeychainCredentialStore()
  private lazy var session = MobileSession(store: credentialStore)
  private var appGroupStore: AppGroupStore?
  private var captureQueue: OfflineCaptureQueue?

  init() {
    do {
      let group = try AppGroupStore()
      appGroupStore = group
      captureQueue = OfflineCaptureQueue(fileURL: group.captureQueueURL)
    } catch {
      lastError = error.localizedDescription
    }
  }

  func start() async {
    do {
      let restored = try await session.restore()
      guard let restored else {
        connectionState = .disconnected
        await updatePendingCount()
        return
      }
      connectionState = .connected(deviceName: restored.device.deviceName)
      notificationPreferences = NotificationPreferences(
        dictionary: restored.device.notificationPreferences)
      NotificationManager.shared.registerIfAuthorized()
      await refreshAll()
      await flushCaptures()
    } catch ActionHubAPIError.revoked {
      connectionState = .disconnected
      lastError = nil
    } catch {
      connectionState = .failed(error.localizedDescription)
    }
    await updatePendingCount()
  }

  func pair(using rawPayload: String) async {
    isRefreshing = true
    defer { isRefreshing = false }
    do {
      let payload = try PairingPayload.parse(rawPayload)
      let device = try await session.pair(
        payload: payload,
        deviceInfo: MobileDeviceInfo(
          name: UIDevice.current.name,
          hardwareModel: Self.hardwareModel,
          osVersion: UIDevice.current.systemVersion,
          appVersion: AppConfiguration.appVersion,
          pushEnvironment: AppConfiguration.pushEnvironment
        )
      )
      connectionState = .connected(deviceName: device.deviceName)
      notificationPreferences = NotificationPreferences(dictionary: device.notificationPreferences)
      lastError = nil
      await flushCaptures()
      await refreshAll()
      NotificationManager.shared.requestAuthorizationAndRegister()
    } catch {
      lastError = error.localizedDescription
      connectionState = .disconnected
    }
  }

  func resetConnection() {
    connectionState = .disconnected
    lastError = nil
  }

  func consumePendingPairingPayload() -> String? {
    defer { pendingPairingPayload = nil }
    return pendingPairingPayload
  }

  func prioritizeReviewPlan(_ planId: String) {
    guard let index = reviewPlans.firstIndex(where: { $0.id == planId }), index != 0 else { return }
    let plan = reviewPlans.remove(at: index)
    reviewPlans.insert(plan, at: 0)
  }

  func updateNotificationPreferences(_ preferences: NotificationPreferences) async throws
    -> MobileDevice
  {
    let device = try await session.updateNotificationPreferences(preferences)
    notificationPreferences = NotificationPreferences(dictionary: device.notificationPreferences)
    return device
  }

  func disconnect() async {
    do { try await session.disconnect(revokeServer: true) } catch {
      lastError = error.localizedDescription
    }
    dashboard = nil
    reviewPlans = []
    activity = []
    connectionState = .disconnected
  }

  func refreshAll() async {
    guard case .connected = connectionState else { return }
    isRefreshing = true
    defer { isRefreshing = false }
    do {
      async let dashboardRequest = session.dashboard(currentAppVersion: AppConfiguration.appVersion)
      async let reviewRequest = session.reviewPlans(limit: 50)
      async let activityRequest = session.activity(limit: 50)
      let (newDashboard, newReview, newActivity) = try await (
        dashboardRequest, reviewRequest, activityRequest
      )
      dashboard = newDashboard
      reviewPlans = newReview
      activity = newActivity
      try appGroupStore?.writeWidgetSnapshot(WidgetSnapshot(dashboard: newDashboard))
      try await synchronizeChanges()
      lastError = nil
    } catch {
      handle(error)
    }
  }

  @discardableResult
  func capture(text: String, source: String = "ios-app") async -> Bool {
    guard let captureQueue else {
      lastError = "App Group 오프라인 큐를 사용할 수 없습니다."
      return false
    }
    do {
      _ = try await captureQueue.enqueue(
        text: text,
        source: source,
        metadata: ["app_version": .string(AppConfiguration.appVersion)]
      )
      await updatePendingCount()
      if case .connected = connectionState { await flushCaptures() }
      return true
    } catch {
      lastError = error.localizedDescription
      return false
    }
  }

  func flushCaptures() async {
    guard case .connected = connectionState, let captureQueue else {
      await updatePendingCount()
      return
    }
    do {
      while let response = try await captureQueue.flush(using: session, batchSize: 25) {
        if response.processed + response.duplicate == 0 { break }
      }
      await updatePendingCount()
      reviewPlans = try await session.reviewPlans(limit: 50)
      dashboard = try await session.dashboard(currentAppVersion: AppConfiguration.appVersion)
      if let dashboard {
        try appGroupStore?.writeWidgetSnapshot(WidgetSnapshot(dashboard: dashboard))
      }
    } catch {
      lastError = error.localizedDescription
      await updatePendingCount()
    }
  }

  func loadPlan(_ id: String) async throws -> ActionPlan {
    try await session.plan(id: id)
  }

  func updateItem(planId: String, itemId: String, patch: ActionItemPatch) async throws -> ActionPlan
  {
    let updated = try await session.updateItem(planId: planId, itemId: itemId, patch: patch)
    replacePlan(updated)
    return updated
  }

  func approve(plan: ActionPlan, itemIds: [String]? = nil) async throws -> ActionPlan {
    let updated = try await session.approve(
      planId: plan.id,
      request: PlanApprovalRequest(
        itemIds: itemIds,
        forceReviewItems: true,
        expectedPlanRevision: plan.revision
      )
    )
    replacePlan(updated)
    await refreshAll()
    return updated
  }

  func reject(plan: ActionPlan, itemIds: [String]? = nil, reason: String = "iOS에서 제외") async throws
    -> ActionPlan
  {
    let updated = try await session.reject(
      planId: plan.id,
      request: PlanRejectRequest(
        itemIds: itemIds, reason: reason, expectedPlanRevision: plan.revision)
    )
    replacePlan(updated)
    await refreshAll()
    return updated
  }

  func execute(plan: ActionPlan, itemIds: [String]? = nil) async throws -> ExecutionSummary {
    let summary = try await session.execute(
      planId: plan.id,
      request: PlanExecuteRequest(itemIds: itemIds, expectedPlanRevision: plan.revision)
    )
    reviewPlans.removeAll { $0.id == plan.id }
    await refreshAll()
    return summary
  }

  func registerPushToken(_ data: Data) async {
    guard case .connected = connectionState else { return }
    let token = data.map { String(format: "%02x", $0) }.joined()
    do {
      _ = try await session.registerPushToken(token, environment: AppConfiguration.pushEnvironment)
    } catch {
      lastError = "푸시 토큰 등록 실패: \(error.localizedDescription)"
    }
  }

  func handleDeepLink(_ url: URL) {
    guard url.scheme == "jmactionhub" else { return }
    switch url.host {
    case "pair":
      guard case .connected = connectionState else {
        // A custom URL can be opened by another app or a web page. Do not claim
        // credentials without a visible user confirmation in PairingView.
        pendingPairingPayload = url.absoluteString
        connectionState = .disconnected
        return
      }
      lastError = "새 서버에 연결하려면 현재 iPhone 연결을 먼저 해제하세요."
    case "capture":
      isCapturePresented = true
    case "review":
      selectedTab = .review
      presentedPlanId =
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?.first(where: { $0.name == "plan_id" })?.value
      if let presentedPlanId { reviewNavigationPath = [presentedPlanId] }
    case "activity": selectedTab = .activity
    case "today": selectedTab = .today
    default: break
    }
  }

  private func synchronizeChanges() async throws {
    var cursor = appGroupStore?.readSyncCursor()
    var pageCount = 0
    repeat {
      let response = try await session.changes(cursor: cursor, limit: 200)
      cursor = response.nextCursor
      try appGroupStore?.writeSyncCursor(cursor)
      pageCount += 1
      if !response.hasMore { break }
      // Bound a single foreground refresh so a very old device cannot monopolize the UI.
      // The next refresh resumes from the durable cursor.
    } while pageCount < 10
  }

  private func replacePlan(_ plan: ActionPlan) {
    if let index = reviewPlans.firstIndex(where: { $0.id == plan.id }) {
      reviewPlans[index] = plan
    } else {
      reviewPlans.insert(plan, at: 0)
    }
  }

  private func updatePendingCount() async {
    guard let captureQueue else {
      pendingCaptureCount = 0
      return
    }
    pendingCaptureCount = (try? await captureQueue.count()) ?? 0
  }

  private func handle(_ error: Error) {
    if case ActionHubAPIError.revoked = error {
      connectionState = .disconnected
    }
    lastError = error.localizedDescription
  }

  private static var hardwareModel: String {
    var systemInfo = utsname()
    uname(&systemInfo)
    return withUnsafePointer(to: &systemInfo.machine) {
      $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
    }
  }
}

enum AppTab: Hashable {
  case today, review, activity, settings
}
