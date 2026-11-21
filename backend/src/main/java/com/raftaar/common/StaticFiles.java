package com.raftaar.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.EncodedResourceResolver;

import java.time.Duration;
import java.util.Arrays;

/**
 * The app's built files under /assets/ have a hash in their name, so they never change: the browser may keep them
 * for a year without asking again. They're sent pre-compressed (.br or .gz, made at build time) when the browser
 * accepts it. Everything else (index.html, the service worker, the manifest) stays uncached so updates show at once.
 */
@Configuration
public class StaticFiles implements WebMvcConfigurer {
    private final String[] assetLocations;

    public StaticFiles(@Value("${spring.web.resources.static-locations}") String[] staticLocations) {
        this.assetLocations = Arrays.stream(staticLocations).map(location -> location.trim().replaceAll("/?$", "/") + "assets/").toArray(String[]::new);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(assetLocations)
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .resourceChain(true)
                .addResolver(new EncodedResourceResolver());
    }
}
