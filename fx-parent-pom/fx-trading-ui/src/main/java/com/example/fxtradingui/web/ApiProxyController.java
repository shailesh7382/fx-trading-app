package com.example.fxtradingui.web;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
public class ApiProxyController {

    private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
            "connection",
            "content-length",
            "host",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade"
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    @Value("${app.proxy.auth-base-url:http://localhost:8080}")
    private String authBaseUrl;

    @Value("${app.proxy.pricing-base-url:http://localhost:8081}")
    private String pricingBaseUrl;

    @RequestMapping({"/auth-api", "/auth-api/**", "/pricing-api", "/pricing-api/**"})
    public ResponseEntity<byte[]> proxy(HttpServletRequest request) throws IOException, InterruptedException {
        String requestPath = request.getRequestURI();
        String targetBaseUrl = requestPath.startsWith("/auth-api") ? authBaseUrl : pricingBaseUrl;
        String rewrittenPath = requestPath.replaceFirst("^/(auth|pricing)-api", "/api");

        UriComponentsBuilder uriBuilder = UriComponentsBuilder.fromHttpUrl(targetBaseUrl)
                .path(rewrittenPath);
        if (request.getQueryString() != null && !request.getQueryString().isBlank()) {
            uriBuilder.query(request.getQueryString());
        }

        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(uriBuilder.build(true).toUriString()));

        copyRequestHeaders(request, requestBuilder);

        HttpMethod httpMethod = HttpMethod.resolve(request.getMethod());
        byte[] requestBody = readRequestBody(request);
        requestBuilder.method(
                httpMethod != null ? httpMethod.name() : request.getMethod(),
                shouldSendBody(request.getMethod()) ? HttpRequest.BodyPublishers.ofByteArray(requestBody) : HttpRequest.BodyPublishers.noBody()
        );

        HttpResponse<byte[]> upstreamResponse = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());
        HttpHeaders responseHeaders = new HttpHeaders();
        upstreamResponse.headers().map().forEach((name, values) -> {
            if (!HOP_BY_HOP_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                responseHeaders.put(name, values);
            }
        });

        return ResponseEntity.status(upstreamResponse.statusCode())
                .headers(responseHeaders)
                .body(upstreamResponse.body());
    }

    private void copyRequestHeaders(HttpServletRequest request, HttpRequest.Builder requestBuilder) {
        Enumeration<String> headerNames = request.getHeaderNames();
        if (headerNames == null) {
            return;
        }

        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            if (HOP_BY_HOP_HEADERS.contains(headerName.toLowerCase(Locale.ROOT))) {
                continue;
            }

            List<String> headerValues = Collections.list(request.getHeaders(headerName));
            for (String headerValue : headerValues) {
                requestBuilder.header(headerName, headerValue);
            }
        }

        requestBuilder.header("X-Forwarded-Host", request.getHeader("Host") == null ? "localhost:5173" : request.getHeader("Host"));
        requestBuilder.header("X-Forwarded-Proto", request.getScheme());
    }

    private byte[] readRequestBody(HttpServletRequest request) throws IOException {
        if (!shouldSendBody(request.getMethod())) {
            return new byte[0];
        }

        return StreamUtils.copyToByteArray(request.getInputStream());
    }

    private boolean shouldSendBody(String method) {
        return !HttpMethod.GET.matches(method) && !HttpMethod.HEAD.matches(method);
    }
}

