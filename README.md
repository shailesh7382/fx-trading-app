# fx-trading-app
This is FX Trading application that streams FX Rates and allows users to trade on it. 
This is a java project designed using Spring Boot, React JS, Active MQ, H2 Database . It is build using maven and npm for JDK 11. 


## Getting Started
To get you started you can simply clone the `fx-trading-app` repository and open in IntelliJ IDEA.
![img.png](img.png)

- create a parent pom extending spring  boot. 
![img_1.png](img_1.png)
- create a child pom for user login and authentication and persistence of user to db 
![img_2.png](img_2.png)
- Now fully running for fx-auth-rs with user login and persistence to db.
![img_3.png](img_3.png)
- Now created common data to generate pricing for 30 ccy pairs using a controlled random in place. 
![img_4.png](img_4.png)
- We have created ActiveMQ Application that is publishing market data to mq topic every 500ms for 28 pairs.
![img_5.png](img_5.png)
- created fx-pricing-rs to subscribe to MQ for prices and persiste them in data base. 
Also host rest api for retrieving prices.
![img_6.png](img_6.png)
- Testing all of it together with DB 
![img_7.png](img_7.png)
- <BREAK> Starting again - We will create a react js ui not to provide for a user login and a rate grid using the built backend services
![img_8.png](img_8.png)
- created a demo react app 
![img_9.png](img_9.png)
fx-parent-pom/
├── fx-trading-ui/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── com/example/fxtradingui/
│   │   │   │       └── ReactAppController.java
│   │   │   ├── resources/
│   │   │   │   └── static/
│   │   │   │       ├── index.html
│   │   │   │       ├── static/
│   │   │   │       ├── asset-manifest.json
│   │   │   │       ├── manifest.json
│   │   │   │       ├── robots.txt
│   │   │   │       └── ...
│   ├── pom.xml
│   └── fx-trading-app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       ├── package-lock.json
│       └── ...

- Now login screen linked to server backend and logged in 
![img_10.png](img_10.png)

- Created FX Trading Navigation 
![img_11.png](img_11.png)

- Created Menu options and navigation
![img_12.png](img_12.png)

- Rate Grid added to retrieve prices from backend service
![img_13.png](img_13.png)
- OVER and Out for today