package com.raftaar.notifications;

import com.raftaar.common.AppProperties;
import com.raftaar.common.Settings;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Sending to a stand-in push service on this machine, which reads what it gets with the browser's own keys. */
class WebPushTest {
    HttpServer pushService;
    final AtomicInteger answer = new AtomicInteger(201);
    final AtomicReference<byte[]> received = new AtomicReference<>();
    final Map<String, String> headers = new HashMap<>();
    KeyPair browser;
    byte[] auth = new byte[16];
    PushSubscriptionRepo repo = mock(PushSubscriptionRepo.class);
    PushSubscription device = new PushSubscription();
    WebPush push;

    @BeforeEach
    void setUp() throws Exception {
        pushService = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        pushService.createContext("/push/abc", exchange -> {
            received.set(exchange.getRequestBody().readAllBytes());
            for (String name : List.of("TTL", "Content-Encoding", "Authorization")) headers.put(name, exchange.getRequestHeaders().getFirst(name));
            exchange.sendResponseHeaders(answer.get(), -1);
            exchange.close();
        });
        pushService.start();

        browser = PushCrypto.newKeyPair();
        Arrays.fill(auth, (byte) 7);
        device.id = 1L;
        device.label = "Test phone";
        device.endpoint = "http://127.0.0.1:" + pushService.getAddress().getPort() + "/push/abc";
        device.p256dh = PushCrypto.base64(PushCrypto.uncompressed((ECPublicKey) browser.getPublic()));
        device.auth = PushCrypto.base64(auth);
        when(repo.findAllByOrderByIdAsc()).thenReturn(List.of(device));

        var stored = new HashMap<String, String>();
        var settings = mock(Settings.class);
        when(settings.get(anyString())).thenAnswer(call -> Optional.ofNullable(stored.get(call.<String>getArgument(0))));
        doAnswer(call -> stored.put(call.getArgument(0), call.getArgument(1).toString())).when(settings).set(anyString(), any());
        var props = new AppProperties(null, null, null, null, null, null, null, null, null, new AppProperties.Push("https://example.org/raftaar"));
        push = new WebPush(repo, settings, props, JsonMapper.builder().build());
    }

    @AfterEach
    void tearDown() {
        pushService.stop(0);
    }

    @Test
    void theBrowserCanReadWhatItGets() throws Exception {
        var outcome = push.send("Vehicle reminder", "Activa: chain lube due in 300 km", "/");
        assertEquals(1, outcome.sent());
        assertEquals("{\"body\":\"Activa: chain lube due in 300 km\",\"title\":\"Vehicle reminder\",\"url\":\"/\"}",
                sortedJson(new String(decrypt(received.get()), StandardCharsets.UTF_8)));
        assertEquals("aes128gcm", headers.get("Content-Encoding"));
        assertEquals("86400", headers.get("TTL"));
        assertTrue(headers.get("Authorization").startsWith("vapid t="));
        assertTrue(headers.get("Authorization").endsWith("k=" + push.publicKey()));
        assertTrue(device.lastOk);
    }

    @Test
    void aDeviceThatsGoneIsForgotten() {
        answer.set(410);
        var outcome = push.send("Vehicle reminder", "x", "/");
        assertEquals(0, outcome.sent());
        assertEquals(0, outcome.failed(), "gone isn't a failure: there's nothing left to send to");
        verify(repo).delete(device);
    }

    @Test
    void otherAnswersAreFailuresThatSaySo() {
        answer.set(429);
        var outcome = push.send("Vehicle reminder", "x", "/");
        assertEquals(1, outcome.failed());
        assertEquals("The push service answered 429", device.lastError);
        assertFalse(device.lastOk);
    }

    @Test
    void theServersKeysAreMadeOnceAndKept() {
        assertEquals(push.publicKey(), push.publicKey());
        assertEquals(65, PushCrypto.unbase64(push.publicKey()).length);
    }

    /** What the browser does with a push: undoes RFC 8291 with its private key. */
    private byte[] decrypt(byte[] body) throws Exception {
        var buffer = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        buffer.get(salt);
        buffer.getInt();
        byte[] serverPublic = new byte[buffer.get()];
        buffer.get(serverPublic);
        byte[] sealed = new byte[buffer.remaining()];
        buffer.get(sealed);
        var agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(browser.getPrivate());
        agreement.doPhase(PushCrypto.publicKey(serverPublic), true);
        byte[] browserPublic = PushCrypto.uncompressed((ECPublicKey) browser.getPublic());
        byte[] keyInfo = ByteBuffer.allocate(14 + 65 + 65).put("WebPush: info\0".getBytes(StandardCharsets.US_ASCII)).put(browserPublic).put(serverPublic).array();
        byte[] ikm = PushCrypto.hkdf(auth, agreement.generateSecret(), keyInfo, 32);
        byte[] key = PushCrypto.hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = PushCrypto.hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);
        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = cipher.doFinal(sealed);
        assertEquals(2, plain[plain.length - 1], "the last record's delimiter");
        return Arrays.copyOf(plain, plain.length - 1);
    }

    private static String sortedJson(String text) {
        var map = new java.util.TreeMap<String, Object>(JsonMapper.builder().build().readValue(text, Map.class));
        return JsonMapper.builder().build().writeValueAsString(map);
    }
}
