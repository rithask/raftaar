package com.raftaar.notifications;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;

/**
 * The cryptography of Web Push, with the JDK's own providers: the server's VAPID keys and the token that says a
 * push is from it (RFC 8292), and a message encrypted for one browser so only it can read it (RFC 8291, aes128gcm).
 * Keys are on the P-256 curve; public keys travel as 65 bytes, uncompressed, in unpadded base64url.
 */
public final class PushCrypto {
    private PushCrypto() {}

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder UNB64 = Base64.getUrlDecoder();
    /** The record size written in the message header; a push message is far smaller than one record. */
    private static final int RECORD_SIZE = 4096;

    public static String base64(byte[] bytes) {
        return B64.encodeToString(bytes);
    }

    public static byte[] unbase64(String text) {
        return UNB64.decode(text.strip().replace('+', '-').replace('/', '_').replace("=", ""));
    }

    // ---- keys -----------------------------------------------------------------------------------------------

    public static KeyPair newKeyPair() throws GeneralSecurityException {
        var generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        return generator.generateKeyPair();
    }

    /** A public key as browsers take it: 0x04, then x and y, 32 bytes each. */
    public static byte[] uncompressed(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        copyUnsigned(key.getW().getAffineX(), out, 1);
        copyUnsigned(key.getW().getAffineY(), out, 33);
        return out;
    }

    static ECPublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 4) throw new GeneralSecurityException("Not an uncompressed P-256 public key");
        var point = new ECPoint(new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33)), new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, curve()));
    }

    /** A private key from its 32 bytes (the test vectors give them so). */
    static PrivateKey privateKey(byte[] scalar) throws GeneralSecurityException {
        return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), curve()));
    }

    public static PrivateKey privateKeyFromPkcs8(byte[] encoded) throws GeneralSecurityException {
        return KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(encoded));
    }

    private static ECParameterSpec curve() throws GeneralSecurityException {
        var generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return ((ECPublicKey) generator.generateKeyPair().getPublic()).getParams();
    }

    // ---- VAPID (RFC 8292) -----------------------------------------------------------------------------------

    /**
     * The Authorization header for a push to {@code endpoint}: a token signed with the server's key, for the push
     * service at the endpoint's origin, good for 12 hours; {@code contact} tells the push service whom to ask about it.
     */
    public static String vapidHeader(String endpoint, String contact, PrivateKey key, byte[] publicKey, Instant now) throws GeneralSecurityException {
        var url = java.net.URI.create(endpoint);
        String audience = url.getScheme() + "://" + url.getRawAuthority();
        String header = base64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = base64(("{\"aud\":\"" + audience + "\",\"exp\":" + now.plusSeconds(12 * 3600).getEpochSecond()
                + ",\"sub\":\"" + contact.replace("\"", "") + "\"}").getBytes(StandardCharsets.UTF_8));
        var signer = Signature.getInstance("SHA256withECDSAinP1363Format"); // r and s side by side, as JWT wants
        signer.initSign(key);
        signer.update((header + "." + claims).getBytes(StandardCharsets.US_ASCII));
        return "vapid t=" + header + "." + claims + "." + base64(signer.sign()) + ", k=" + base64(publicKey);
    }

    // ---- encryption (RFC 8291) ------------------------------------------------------------------------------

    /** {@code message} encrypted for the browser with these keys (from its subscription), as the push body. */
    public static byte[] encrypt(byte[] message, byte[] browserPublicKey, byte[] authSecret) throws GeneralSecurityException {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(message, browserPublicKey, authSecret, newKeyPair(), salt);
    }

    /** With the server's one-off key pair and salt given: the random parts, fixed for the RFC's worked example. */
    static byte[] encrypt(byte[] message, byte[] browserPublicKey, byte[] authSecret, KeyPair ephemeral, byte[] salt) throws GeneralSecurityException {
        byte[] serverPublic = uncompressed((ECPublicKey) ephemeral.getPublic());
        var agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(ephemeral.getPrivate());
        agreement.doPhase(publicKey(browserPublicKey), true);
        byte[] shared = agreement.generateSecret();

        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), browserPublicKey, serverPublic);
        byte[] ikm = hkdf(authSecret, shared, keyInfo, 32);
        byte[] contentKey = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(contentKey, "AES"), new GCMParameterSpec(128, nonce));
        byte[] sealed = cipher.doFinal(concat(message, new byte[]{2})); // 2: the last (and only) record, no padding

        return ByteBuffer.allocate(16 + 4 + 1 + serverPublic.length + sealed.length)
                .put(salt).putInt(RECORD_SIZE).put((byte) serverPublic.length).put(serverPublic).put(sealed).array();
    }

    /** HKDF with SHA-256, for at most one block of output (all Web Push needs). */
    static byte[] hkdf(byte[] salt, byte[] secret, byte[] info, int length) throws GeneralSecurityException {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] pseudoRandomKey = mac.doFinal(secret);
        mac.init(new SecretKeySpec(pseudoRandomKey, "HmacSHA256"));
        return Arrays.copyOf(mac.doFinal(concat(info, new byte[]{1})), length);
    }

    private static byte[] concat(byte[]... parts) {
        int length = 0;
        for (byte[] part : parts) length += part.length;
        var out = ByteBuffer.allocate(length);
        for (byte[] part : parts) out.put(part);
        return out.array();
    }

    private static void copyUnsigned(BigInteger value, byte[] into, int at) {
        byte[] bytes = value.toByteArray();
        int skip = bytes.length > 32 ? bytes.length - 32 : 0; // a leading sign byte
        System.arraycopy(bytes, skip, into, at + 32 - (bytes.length - skip), bytes.length - skip);
    }
}
