package com.raftaar.notifications;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Push notifications on phones and browsers: the server's key to subscribe with, and the devices that have. */
@RestController
@RequestMapping("/api/push")
public class PushController {
    private final WebPush push;

    public PushController(WebPush push) {
        this.push = push;
    }

    public record Devices(String publicKey, List<PushSubscription> devices) {}

    /** A browser's subscription, as PushSubscription.toJSON() gives it, and a name for the device. */
    public record Subscribe(String endpoint, Keys keys, String label) {
        public record Keys(String p256dh, String auth) {}
    }

    @GetMapping
    public Devices devices() {
        return new Devices(push.publicKey(), push.devices());
    }

    @PostMapping("/devices")
    public PushSubscription subscribe(@RequestBody Subscribe subscription) {
        if (subscription.endpoint() == null || subscription.keys() == null) throw new IllegalArgumentException("That isn't a push subscription");
        return push.subscribe(subscription.endpoint(), subscription.keys().p256dh(), subscription.keys().auth(), subscription.label());
    }

    @DeleteMapping("/devices/{id}")
    public void remove(@PathVariable Long id) {
        push.remove(id);
    }

    @PostMapping("/devices/{id}/test")
    public PushSubscription test(@PathVariable Long id) {
        return push.test(id);
    }
}
