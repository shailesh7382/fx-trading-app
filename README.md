# fx-trading-app
This is FX Trading application that streams FX Rates and allows users to trade on it. 
This is a java project designed using Spring Boot, React JS, Active MQ, H2 Database . It is build using maven and npm for JDK 11. 


## Getting Started
To get you started you can simply clone the `fx-trading-app` repository and open in IntelliJ IDEA.
![img.png](img.png)

- create a parent pom extending spring  boot. 
- ![img_1.png](img_1.png)
- create a child pom for user login and authentication and persistence of user to db 
- ![img_2.png](img_2.png)
- Now fully running 
- ![img_3.png](img_3.png)
- Now created common data to generate pricing for 30 ccy pairs using a controlled random in place. 
- ![img_4.png](img_4.png)