package com.example.fx.simulator;

import java.util.Objects;
import com.atlassian.oai.validator.OpenApiInteractionValidator;
import com.atlassian.oai.validator.model.Request;
import com.atlassian.oai.validator.model.SimpleRequest;
import com.atlassian.oai.validator.model.SimpleResponse;
import com.atlassian.oai.validator.report.ValidationReport;
import org.springframework.test.web.servlet.MvcResult;
import static org.assertj.core.api.Assertions.assertThat;

final class ContractAssertions {
    private static final OpenApiInteractionValidator VALIDATOR = OpenApiInteractionValidator
            .createForSpecificationUrl(Objects.requireNonNull(ContractAssertions.class.getResource(
                    "/META-INF/resources/openapi/fx-trading-systems-api.yaml")).toExternalForm())
            .withResolveCombinators(false).build();

    static void validResponse(MvcResult result) throws Exception {
        var response = result.getResponse();
        var builder = SimpleResponse.Builder.status(response.getStatus()).withBody(response.getContentAsString());
        for (String name : response.getHeaderNames()) builder.withHeader(name, response.getHeaders(name));
        ValidationReport report = VALIDATOR.validateResponse(result.getRequest().getRequestURI(),
                Request.Method.valueOf(result.getRequest().getMethod()), builder.build());
        assertThat(report.hasErrors()).as("Response contract violations: %s", report.getMessages()).isFalse();
    }

    static ValidationReport priceResponse(String body) {
        return VALIDATOR.validateResponse("/api/v1/pricing/quotes", Request.Method.POST,
                SimpleResponse.Builder.status(201).withContentType("application/json").withBody(body).build());
    }

    static ValidationReport priceRequest(String body) {
        return VALIDATOR.validateRequest(SimpleRequest.Builder.post("/api/v1/pricing/quotes")
                .withContentType("application/json").withBody(body).build());
    }
}
