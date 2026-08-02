import ActionHubCore
import AppIntents
import Foundation

struct CaptureTextIntent: AppIntent {
  static let title: LocalizedStringResource = "Action Hub에 추가"
  static let description = IntentDescription("말하거나 입력한 내용을 Action Hub 검토 큐에 안전하게 저장합니다.")
  static var openAppWhenRun = false

  @Parameter(title: "내용", requestValueDialog: "무엇을 Action Hub에 추가할까요?")
  var text: String

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let group =
      Bundle.main.object(forInfoDictionaryKey: "ActionHubAppGroup") as? String
      ?? "group.com.jmactionhub.shared"
    guard
      let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)
    else {
      throw AppGroupError.unavailable(group)
    }
    let queue = OfflineCaptureQueue(
      fileURL: container.appendingPathComponent("captures/pending.json"))
    _ = try await queue.enqueue(text: text, source: "ios-app-intent")
    return .result(dialog: "Action Hub 오프라인 검토 큐에 저장했습니다. 앱이 열리면 서버로 전송합니다.")
  }
}

struct OpenActionHubIntent: AppIntent {
  static let title: LocalizedStringResource = "Action Hub 열기"
  static let description = IntentDescription("오늘의 계획과 검토 대기를 엽니다.")
  static var openAppWhenRun = true

  func perform() async throws -> some IntentResult {
    .result()
  }
}

struct ActionHubShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: CaptureTextIntent(),
      phrases: [
        "\(.applicationName)에 추가",
        "\(.applicationName)에 할 일 추가",
        "\(.applicationName)로 수집",
      ],
      shortTitle: "Action Hub에 추가",
      systemImageName: "plus.circle.fill"
    )
    AppShortcut(
      intent: OpenActionHubIntent(),
      phrases: ["\(.applicationName) 열기", "\(.applicationName) 오늘 보여줘"],
      shortTitle: "Action Hub 열기",
      systemImageName: "point.3.connected.trianglepath.dotted"
    )
  }
}
