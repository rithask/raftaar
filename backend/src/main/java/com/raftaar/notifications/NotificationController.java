package com.raftaar.notifications;

import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Where reminders are sent: Apprise URLs, added and tested in Settings; and a test to everywhere at once. */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final Notifications notifications;

    public NotificationController(Notifications notifications) {
        this.notifications = notifications;
    }

    /** {@code apprise}: the Apprise version, or null when it can't be run. */
    public record ChannelList(String apprise, List<Notifications.Channel> channels) {}

    public record ChannelInput(String label, String url, Boolean enabled) {}

    @GetMapping("/channels")
    public ChannelList list() {
        return new ChannelList(notifications.appriseVersion(), notifications.channels());
    }

    @PostMapping("/channels")
    public Notifications.Channel add(@RequestBody ChannelInput input) {
        return notifications.add(input.label(), input.url());
    }

    @PutMapping("/channels/{id}")
    public Notifications.Channel update(@PathVariable Long id, @RequestBody ChannelInput input) {
        return notifications.update(id, input.label(), input.enabled());
    }

    @DeleteMapping("/channels/{id}")
    public void delete(@PathVariable Long id) {
        notifications.delete(id);
    }

    @PostMapping("/channels/{id}/test")
    public Notifications.Channel test(@PathVariable Long id) {
        return notifications.test(id);
    }

    /** A test through every channel and to every device: how many got it, and why any didn't. */
    @PostMapping("/test")
    public Notifications.Outcome testAll() {
        return notifications.testAll();
    }
}
