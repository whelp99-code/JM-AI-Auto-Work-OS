import ActionHubCore
import SwiftUI
import WidgetKit

struct ActionHubWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
}

struct ActionHubTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> ActionHubWidgetEntry {
    .init(
      date: Date(),
      snapshot: .init(
        reviewCount: 3, waitingCount: 2, aiRunningCount: 1, overloadMinutes: 90,
        topTitles: ["HCI 제안서", "고객 미팅", "PR 검토"]))
  }

  func getSnapshot(in context: Context, completion: @escaping (ActionHubWidgetEntry) -> Void) {
    completion(.init(date: Date(), snapshot: readSnapshot()))
  }

  func getTimeline(
    in context: Context, completion: @escaping (Timeline<ActionHubWidgetEntry>) -> Void
  ) {
    let entry = ActionHubWidgetEntry(date: Date(), snapshot: readSnapshot())
    completion(Timeline(entries: [entry], policy: .after(Date(timeIntervalSinceNow: 30 * 60))))
  }

  private func readSnapshot() -> WidgetSnapshot {
    let group =
      Bundle.main.object(forInfoDictionaryKey: "ActionHubAppGroup") as? String
      ?? "group.com.jmactionhub.shared"
    guard
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group),
      let data = try? Data(contentsOf: container.appendingPathComponent("widget/dashboard.json")),
      let snapshot = try? ActionHubJSON.decoder().decode(WidgetSnapshot.self, from: data)
    else {
      return .init()
    }
    return snapshot
  }
}

struct ActionHubWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ActionHubWidgetEntry

  var body: some View {
    switch family {
    case .systemSmall: small
    default: medium
    }
  }

  private var small: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Image(systemName: "point.3.connected.trianglepath.dotted")
        Text("Action Hub").font(.headline)
      }
      Spacer()
      HStack {
        WidgetMetric(value: entry.snapshot.reviewCount, label: "검토")
        WidgetMetric(value: entry.snapshot.aiRunningCount, label: "AI")
      }
      Link(destination: URL(string: "jmactionhub://capture")!) {
        Label("빠른 입력", systemImage: "plus.circle.fill").font(.caption.bold())
      }
    }
    .containerBackground(.fill.tertiary, for: .widget)
  }

  private var medium: some View {
    HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 8) {
        Label("오늘의 Top", systemImage: "target").font(.headline)
        ForEach(Array(entry.snapshot.topTitles.prefix(3).enumerated()), id: \.offset) {
          index, title in
          Text("\(index + 1). \(title)")
            .font(.caption)
            .lineLimit(1)
            .privacySensitive()
        }
        if entry.snapshot.topTitles.isEmpty {
          Text("동기화 후 표시됩니다").font(.caption).foregroundStyle(.secondary)
        }
      }
      Divider()
      VStack(alignment: .leading, spacing: 8) {
        Label("검토 \(entry.snapshot.reviewCount)", systemImage: "checklist")
          .privacySensitive()
        Label("대기 \(entry.snapshot.waitingCount)", systemImage: "hourglass")
          .privacySensitive()
        Label("AI \(entry.snapshot.aiRunningCount)", systemImage: "sparkles")
          .privacySensitive()
        if entry.snapshot.overloadMinutes > 0 {
          Label("초과 \(entry.snapshot.overloadMinutes)분", systemImage: "exclamationmark.triangle")
            .foregroundStyle(.red)
        }
      }
      .font(.caption)
    }
    .containerBackground(.fill.tertiary, for: .widget)
  }
}

private struct WidgetMetric: View {
  let value: Int
  let label: String
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text("\(value)").font(.title2.bold()).contentTransition(.numericText())
      Text(label).font(.caption2).foregroundStyle(.secondary)
    }
  }
}

struct ActionHubWidget: Widget {
  let kind = "ActionHubWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: ActionHubTimelineProvider()) { entry in
      ActionHubWidgetView(entry: entry)
    }
    .configurationDisplayName("JM-AI Action Hub")
    .description("검토, 응답 대기, AI 실행 상태와 오늘의 우선 업무를 확인합니다.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct ActionHubWidgetBundle: WidgetBundle {
  var body: some Widget { ActionHubWidget() }
}
