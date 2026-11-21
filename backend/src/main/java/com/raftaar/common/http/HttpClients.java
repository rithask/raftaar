package com.raftaar.common.http;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
public class HttpClients {
    /** Shared base for the outside services. A generic User-Agent: OpenStreetMap services ask for one. */
    @Bean
    RestClient outboundClient() {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NORMAL).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(60));
        return RestClient.builder().requestFactory(factory).defaultHeader("User-Agent", "Raftaar/0.1 (self-hosted vehicle log)")
                .requestInterceptor(new NamedRequests()) // failures name their request (see NamedRequests)
                .build();
    }
}
