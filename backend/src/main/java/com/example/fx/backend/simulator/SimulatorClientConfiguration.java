package com.example.fx.backend.simulator;

import com.example.fx.simulator.client.BookingApi;
import com.example.fx.simulator.client.PricingApi;
import com.example.fx.simulator.client.RestingOrdersApi;
import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
@EnableConfigurationProperties(SimulatorClientProperties.class)
public class SimulatorClientConfiguration {

    @Bean
    HttpServiceProxyFactory simulatorHttpServiceProxyFactory(
            RestClient.Builder builder,
            SimulatorClientProperties properties
    ) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        RestClient client = builder.baseUrl(properties.baseUrl().toString())
                .requestFactory(requestFactory)
                .build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client)).build();
    }

    @Bean
    PricingApi simulatorPricingApi(HttpServiceProxyFactory factory) {
        return factory.createClient(PricingApi.class);
    }

    @Bean
    BookingApi simulatorBookingApi(HttpServiceProxyFactory factory) {
        return factory.createClient(BookingApi.class);
    }

    @Bean
    RestingOrdersApi simulatorRestingOrdersApi(HttpServiceProxyFactory factory) {
        return factory.createClient(RestingOrdersApi.class);
    }
}
