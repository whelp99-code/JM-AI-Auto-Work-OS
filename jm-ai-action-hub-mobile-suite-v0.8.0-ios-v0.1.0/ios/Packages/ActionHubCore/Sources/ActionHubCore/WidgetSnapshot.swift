import Foundation

public struct WidgetSnapshot: Codable, Sendable, Equatable {
  public let generatedAt: Date
  public let reviewCount: Int
  public let waitingCount: Int
  public let aiRunningCount: Int
  public let failedCount: Int
  public let overloadMinutes: Int
  public let topTitles: [String]

  public init(dashboard: MobileDashboard) {
    generatedAt = dashboard.generatedAt
    reviewCount = dashboard.reviewCount
    waitingCount = dashboard.waitingCount
    aiRunningCount = dashboard.aiRunningCount
    failedCount = dashboard.failedCount
    overloadMinutes = dashboard.decision.overloadMinutes
    topTitles = Array(dashboard.decision.topItems.prefix(3).map(\.title))
  }

  public init(
    generatedAt: Date = Date(),
    reviewCount: Int = 0,
    waitingCount: Int = 0,
    aiRunningCount: Int = 0,
    failedCount: Int = 0,
    overloadMinutes: Int = 0,
    topTitles: [String] = []
  ) {
    self.generatedAt = generatedAt
    self.reviewCount = reviewCount
    self.waitingCount = waitingCount
    self.aiRunningCount = aiRunningCount
    self.failedCount = failedCount
    self.overloadMinutes = overloadMinutes
    self.topTitles = topTitles
  }
}
