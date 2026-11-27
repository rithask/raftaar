package com.raftaar.notifications;

import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Where reminders are sent: Apprise URLs, added and tested in Settings. */
@RestController
@RequestMapping("/api/notifications/channels")
public class NotificationController {
    private final Notifications notifications;

    public NotificationController(Notifications notifications) {
        this.notifications = notifications;
    }

    /** {@code apprise}: the Apprise version, or null when it can't be run. */
    public record ChannelList(String apprise, List<Notifications.Channel> channels) {}

    public record ChannelInput(String label, String url, Boolean enabled) {}

    @GetMapping
    public ChannelList list() {
        return new ChannelList(notifications.appriseVersion(), notifications.channels());
    }

    @PostMapping
    public Notifications.Channel add(@RequestBody ChannelInput input) {
        return notifications.add(input.label(), input.url());
    }

    @PutMapping("/{id}")
    public Notifications.Channel update(@PathVariable Long id, @RequestBody ChannelInput input) {
        return notifications.update(id, input.label(), input.enabled());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        notifications.delete(id);
    }

    @PostMapping("/{id}/test")
    public Notifications.Channel test(@PathVariable Long id) {
        return notifications.test(id);
    }
}
