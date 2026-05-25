# fx-trading-app

FX Trading application that streams FX rates and allows users to trade.

The platform is built with Spring Boot services, a React UI, ActiveMQ for streaming market data, and H2 Database for persistence. The project uses Maven (Java modules) and npm (UI module).

## Getting Started

Clone the repository and open it in IntelliJ IDEA.

## Development Progress (Screenshots)

> All screenshots are now organized under `images/`.

Initial setup
![Initial setup](images/img.png)

Created parent POM extending Spring Boot
![Parent POM](images/img_1.png)

Created auth service module and DB persistence for users
![Auth service module](images/img_2.png)

`fx-auth-rs` running with login and persistence
![Auth service running](images/img_3.png)

Created common market data generator for 30 currency pairs
![Common market data](images/img_4.png)

Created ActiveMQ publisher streaming market data every 500ms for 28 pairs
![MQ publisher](images/img_5.png)

Created `fx-pricing-rs` subscriber, DB persistence, and REST API for prices
![Pricing service](images/img_6.png)

Integrated backend services with database
![Backend integration](images/img_7.png)

Started React UI development for login and rate grid
![UI start](images/img_8.png)

Created demo React app
![React demo app](images/img_9.png)

Connected login screen to backend authentication
![Login integration](images/img_10.png)

Created FX trading navigation
![Navigation](images/img_11.png)

Added menu options and navigation flow
![Menu and navigation](images/img_12.png)

Added rate grid fetching prices from backend service
![Rate grid](images/img_13.png)

Done for the day.
