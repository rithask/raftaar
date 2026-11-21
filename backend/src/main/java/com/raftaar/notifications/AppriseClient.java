package com.raftaar.notifications;

import com.raftaar.common.AppProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Runs the Apprise CLI that ships inside Raftaar's image (pinned in the Dockerfile). The URL goes in through the
 * APPRISE_URLS environment variable, which the CLI reads itself, so tokens never appear in the process list; the
 * message body goes in on stdin.
 */
@Component
public class AppriseClient {
    public enum Level { INFO, SUCCESS, WARNING, FAILURE }

    private final String binary;

    public AppriseClient(AppProperties props) {
        this.binary = props.apprise().binary() == null || props.apprise().binary().isBlank() ? "apprise" : props.apprise().binary();
    }

    public record Result(boolean ok, String output) {}

    /** Sends to one URL. */
    public Result send(String url, String title, String body, Level level) {
        // -v: on failure Apprise says why ("Unauthorized, error=401"); it masks tokens in what it prints
        return run(url, body, "-v", "--title", title, "--notification-type", level.name().toLowerCase());
    }

    /** Checks that Apprise understands a URL, without sending anything. */
    public Result check(String url) {
        return run(url, "", "--dry-run", "--body", "check");
    }

    /** Is the CLI there at all? Returns its version line, or null. */
    public String version() {
        try {
            Process process = new ProcessBuilder(binary, "--version").redirectErrorStream(true).start();
            if (!process.waitFor(20, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return null;
            }
            String out = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            return process.exitValue() == 0 && !out.isEmpty() ? out.lines().findFirst().orElse(null) : null;
        } catch (IOException e) {
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private Result run(String url, String stdin, String... args) {
        List<String> cmd = new ArrayList<>();
        cmd.add(binary);
        cmd.addAll(List.of(args));
        ProcessBuilder builder = new ProcessBuilder(cmd).redirectErrorStream(true);
        builder.environment().put("APPRISE_URLS", url);
        try {
            Process process = builder.start();
            try (var in = process.getOutputStream()) {
                in.write(stdin.getBytes(StandardCharsets.UTF_8));
            }
            if (!process.waitFor(60, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                return new Result(false, "Apprise took longer than a minute");
            }
            String out = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            return new Result(process.exitValue() == 0, clean(out, process.exitValue()));
        } catch (IOException e) {
            return new Result(false, "Can't run Apprise (" + binary + "): " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result(false, "Interrupted");
        }
    }

    /** The last useful line of Apprise's output, without its timestamp prefix; never the URL itself. */
    private static String clean(String out, int exit) {
        if (out.isEmpty()) return exit == 0 ? "" : "Apprise failed (exit " + exit + ")";
        String last = out.lines().reduce((a, b) -> b).orElse(out);
        return last.replaceFirst("^\\d{4}-\\d\\d-\\d\\d [\\d:,]+ - [A-Z]+ - ", "");
    }
}
