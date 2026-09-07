package com.example.fx.simulator.config;

import java.util.List;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.cfg.CoercionAction;
import com.fasterxml.jackson.databind.cfg.CoercionInputShape;
import com.fasterxml.jackson.databind.type.LogicalType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class SimulatorWebConfiguration implements WebMvcConfigurer {
    @Bean
    Jackson2ObjectMapperBuilderCustomizer strictContractJson() {
        return builder -> builder.postConfigurer(mapper -> {
            mapper.enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
            mapper.enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
            for (CoercionInputShape shape : List.of(CoercionInputShape.Integer, CoercionInputShape.Float, CoercionInputShape.Boolean)) {
                mapper.coercionConfigFor(LogicalType.Textual).setCoercion(shape, CoercionAction.Fail);
            }
            mapper.coercionConfigFor(LogicalType.Float).setCoercion(CoercionInputShape.String, CoercionAction.Fail)
                    .setCoercion(CoercionInputShape.EmptyString, CoercionAction.Fail);
        });
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
                    throws HttpMediaTypeNotAcceptableException {
                String accept = request.getHeader("Accept");
                if (accept != null && MediaType.parseMediaTypes(accept).stream()
                        .noneMatch(type -> type.getQualityValue() > 0 && type.isCompatibleWith(MediaType.APPLICATION_JSON))) {
                    throw new HttpMediaTypeNotAcceptableException(List.of(MediaType.APPLICATION_JSON));
                }
                return true;
            }
        }).addPathPatterns("/api/v1/**");
    }
}
