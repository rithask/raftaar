package com.raftaar.vehicle;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ThumbnailsTest {
    @TempDir
    Path dir;

    @Test
    void smallCopyNameSitsNextToThePhoto() {
        assertEquals("vehicles/abc.small.jpg", Thumbnails.nameFor("vehicles/abc.jpg"));
        assertEquals("vehicles/abc.small.jpg", Thumbnails.nameFor("vehicles/abc"));
        assertEquals("vehicles.d/abc.small.jpg", Thumbnails.nameFor("vehicles.d/abc"));
    }

    @Test
    void shrinksToTheShortSideAndKeepsTheShape() throws Exception {
        Path photo = dir.resolve("photo.png");
        ImageIO.write(new BufferedImage(1600, 900, BufferedImage.TYPE_INT_ARGB), "png", photo.toFile());
        Path small = dir.resolve("photo.small.jpg");

        assertTrue(Thumbnails.write(photo, small));
        BufferedImage read = ImageIO.read(small.toFile());
        assertEquals(Thumbnails.SHORT_SIDE, read.getHeight());
        assertEquals(341, read.getWidth());
        assertFalse(Files.exists(dir.resolve("photo.small.jpg.part")));
    }

    @Test
    void neverScalesUp() {
        BufferedImage tiny = new BufferedImage(100, 80, BufferedImage.TYPE_INT_RGB);
        BufferedImage out = Thumbnails.shrink(tiny, Thumbnails.SHORT_SIDE);
        assertEquals(100, out.getWidth());
        assertEquals(80, out.getHeight());
    }

    @Test
    void aFileThatIsNotAnImageHasNoSmallCopy() throws Exception {
        Path photo = Files.writeString(dir.resolve("photo.heic"), "not an image the JDK reads");
        assertFalse(Thumbnails.write(photo, dir.resolve("photo.small.jpg")));
    }
}
