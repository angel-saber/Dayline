import Foundation
import UserNotifications
import AudioToolbox
import Combine
import DaylineCore

@MainActor
final class ReminderScheduler: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published var description = "Reminders are off"
    private let center = UNUserNotificationCenter.current()
    private var queued: (days: [String: [PlannerNote]], settings: PlannerSettings)?
    private var isRunning = false

    override init() {
        super.init()
        center.delegate = self
    }

    func requestPermission() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            if !granted { description = "Allow notifications in device Settings to enable reminders." }
            return granted
        } catch { description = error.localizedDescription; return false }
    }

    func testSound() { AudioServicesPlaySystemSound(1007) }

    // Serial replacement prevents overlapping edits from leaving stale alarms.
    // Only the next 60 occupied intervals are queued; opening the app refills it.
    func update(days: [String: [PlannerNote]], settings: PlannerSettings) async {
        queued = (days, settings)
        guard !isRunning else { return }
        isRunning = true
        defer { isRunning = false }
        while let next = queued {
            queued = nil
            let pending = await center.pendingNotificationRequests()
            center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("dayline-") })
            guard next.settings.notifications else { description = "Reminders are off"; continue }
            let permission = await center.notificationSettings()
            guard permission.authorizationStatus == .authorized || permission.authorizationStatus == .provisional else {
                description = "Notifications are blocked in device Settings. Your notes still save normally."
                continue
            }
            let plans = Planner.reminders(days: next.days, interval: next.settings.interval, after: Date())
            do {
                for plan in plans {
                    let content = UNMutableNotificationContent()
                    content.title = "Dayline · It’s time"
                    content.body = plan.text
                    if next.settings.sound { content.sound = .default }
                    var components = Planner.calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: plan.date)
                    components.timeZone = .current
                    let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                    try await center.add(UNNotificationRequest(identifier: plan.id, content: content, trigger: trigger))
                }
                description = plans.isEmpty ? "No upcoming unfinished notes to remind you about." : "\(plans.count) upcoming intervals scheduled. Open Dayline regularly to refill reminders."
            } catch { description = "Some reminders could not be scheduled: \(error.localizedDescription)" }
        }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
