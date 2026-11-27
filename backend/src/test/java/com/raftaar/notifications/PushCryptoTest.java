package com.raftaar.notifications;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class PushCryptoTest {
    /** RFC 8291, Appendix A: a message encrypted with fixed keys and salt, and the exact bytes it must come out as. */
    @Test
    void theRfcsWorkedExample() throws Exception {
        byte[] browserPublic = PushCrypto.unbase64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] auth = PushCrypto.unbase64("BTBZMqHH6r4Tts7J_aSIgg");
        var serverPrivate = PushCrypto.privateKey(PushCrypto.unbase64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"));
        var serverPublic = PushCrypto.publicKey(PushCrypto.unbase64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"));
        byte[] salt = PushCrypto.unbase64("DGv6ra1nlYgDCS1FRnbzlw");

        byte[] body = PushCrypto.encrypt("When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8), browserPublic, auth,
                new KeyPair(serverPublic, serverPrivate), salt);

        assertEquals("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_"
                + "yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN", PushCrypto.base64(body));
    }

    @Test
    void publicKeysRoundTrip() throws Exception {
        var keys = PushCrypto.newKeyPair();
        byte[] raw = PushCrypto.uncompressed((ECPublicKey) keys.getPublic());
        assertEquals(65, raw.length);
        assertEquals(keys.getPublic(), PushCrypto.publicKey(raw));
    }

    @Test
    void theVapidTokenIsSignedWithTheServersKey() throws Exception {
        var keys = PushCrypto.newKeyPair();
        byte[] publicKey = PushCrypto.uncompressed((ECPublicKey) keys.getPublic());
        String header = PushCrypto.vapidHeader("https://fcm.googleapis.com/fcm/send/abc", "https://example.org/raftaar", keys.getPrivate(),
                publicKey, Instant.ofEpochSecond(1_800_000_000L));
        assertTrue(header.startsWith("vapid t="));
        assertTrue(header.endsWith(", k=" + PushCrypto.base64(publicKey)));
        String token = header.substring("vapid t=".length(), header.indexOf(','));
        String[] parts = token.split("\\.");
        String claims = new String(PushCrypto.unbase64(parts[1]), StandardCharsets.UTF_8);
        assertEquals("{\"aud\":\"https://fcm.googleapis.com\",\"exp\":1800043200,\"sub\":\"https://example.org/raftaar\"}", claims);
        var verifier = Signature.getInstance("SHA256withECDSAinP1363Format");
        verifier.initVerify(keys.getPublic());
        verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(verifier.verify(PushCrypto.unbase64(parts[2])));
    }
}
