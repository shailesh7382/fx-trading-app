package com.example.fx.backend.tradingsystem;

import com.example.fx.tradingsystems.client.BookingApi;
import com.example.fx.tradingsystems.client.PricingApi;
import com.example.fx.tradingsystems.client.RestingOrdersApi;
import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
@EnableConfigurationProperties(TradingSystemClientProperties.class)
public class TradingSystemClientConfiguration {

    @Bean
    HttpServiceProxyFactory tradingSystemHttpServiceProxyFactory(
            RestClient.Builder builder,
            TradingSystemClientProperties properties
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
    PricingApi tradingSystemPricingApi(HttpServiceProxyFactory factory) {
        return factory.createClient(PricingApi.class);
    }

    @Bean
    BookingApi tradingSystemBookingApi(HttpServiceProxyFactory factory) {
        return factory.createClient(BookingApi.class);
    }

    @Bean
    RestingOrdersApi tradingSystemRestingOrdersApi(HttpServiceProxyFactory factory) {
        return factory.createClient(RestingOrdersApi.class);
    }
}
