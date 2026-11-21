package com.raftaar.vehicle;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Small copies of vehicle photos, for the places that show one at 28–48 px (the sidebar, the garage list): a photo
 * is up to 1600 px and a few hundred KB, its small copy a few KB. Made with the JDK alone; a format it can't read
 * (HEIC, WebP, AVIF) simply has no small copy, and the photo itself is used.
 */
final class Thumbnails {
    private static final Logger log = LoggerFactory.getLogger(Thumbnails.class);
    /** The short side: enough for a 48 px square on a 3× screen, cropped from the middle. */
    static final int SHORT_SIDE = 192;
    private static final float JPEG_QUALITY = 0.82f;

    private Thumbnails() {}

    /** The stored name of a photo's small copy: next to it, "vehicles/<id>.small.jpg" for "vehicles/<id>.jpg". */
    static String nameFor(String photoName) {
        int dot = photoName.lastIndexOf('.');
        return (dot > photoName.lastIndexOf('/') ? photoName.substring(0, dot) : photoName) + ".small.jpg";
    }

    /** Writes the small copy of {@code photo}; false when the photo can't be read as an image. */
    static boolean write(Path photo, Path target) {
        try {
            BufferedImage original = ImageIO.read(photo.toFile());
            if (original == null) {
                log.debug("No small copy of {}: not a format the JDK reads", photo.getFileName());
                return false;
            }
            BufferedImage small = shrink(original, SHORT_SIDE);
            // to a temporary file first, so a request at the same moment never reads half a file
            Path partial = target.resolveSibling(target.getFileName() + ".part");
            writeJpeg(small, partial);
            Files.move(partial, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            log.debug("Small copy of {}: {}x{} → {}x{}, {} bytes", photo.getFileName(), original.getWidth(), original.getHeight(),
                    small.getWidth(), small.getHeight(), Files.size(target));
            return true;
        } catch (IOException | RuntimeException e) {
            log.warn("Couldn't make a small copy of {}: {}", photo.getFileName(), e.toString());
            return false;
        }
    }

    /**
     * Scales so the short side is {@code shortSide} (never up), halving step by step first: one big jump with
     * bilinear sampling skips most pixels and looks grainy.
     */
    static BufferedImage shrink(BufferedImage image, int shortSide) {
        double scale = Math.min(1.0, (double) shortSide / Math.min(image.getWidth(), image.getHeight()));
        int targetWidth = Math.max(1, (int) Math.round(image.getWidth() * scale));
        int targetHeight = Math.max(1, (int) Math.round(image.getHeight() * scale));
        BufferedImage current = opaque(image);
        while (current.getWidth() / 2 >= targetWidth && current.getHeight() / 2 >= targetHeight) {
            current = resize(current, current.getWidth() / 2, current.getHeight() / 2);
        }
        return current.getWidth() == targetWidth && current.getHeight() == targetHeight ? current : resize(current, targetWidth, targetHeight);
    }

    /** As plain RGB: a JPEG has no transparency, so a PNG's transparent parts become white. */
    private static BufferedImage opaque(BufferedImage image) {
        if (image.getType() == BufferedImage.TYPE_INT_RGB) return image;
        BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, image.getWidth(), image.getHeight());
            g.drawImage(image, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    private static BufferedImage resize(BufferedImage image, int width, int height) {
        BufferedImage out = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(image, 0, 0, width, height, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static void writeJpeg(BufferedImage image, Path target) throws IOException {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (var out = ImageIO.createImageOutputStream(target.toFile())) {
            writer.setOutput(out);
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(image, null, null), params);
        } finally {
            writer.dispose();
        }
    }
}
