# Pizzeria_RESTfulAPI
Node.js API for a pizza-delivery company, with Stripe and Mailgun integrration without any NPM packages.
  1. New users can be created, their information can be edited, and they can be deleted. Fields are First Name, Last Name, Email, Street Address.
  2. Users can log in and log out by creating or destroying a token.
  3. When a user is logged in, they should be able to GET all the possible menu items (these items can be hardcoded into the system).
  4. A logged-in user should be able to fill a shopping cart with menu items
  5. A logged-in user should be able to create an order. You should integrate with the Sandbox of Stripe.com to accept their payment.
  6. When an order is placed, you should email the user a receipt. You should integrate with the sandbox of Mailgun.com for this.

This solution implements: CRUD for users. CRUD for connection tokens with 1h expiry that can be renewed on-demand. CRUD for menus. PAY / LIST and Sandbox API integration with Stripe and Mailgun http/https servers to listen on ports 3000/300 Background workers to process "submitted" payments and alert the users by email as well as manage log files.

# Project setup

Once you have downloaded this code, you need to supply some of your information.

  1. You need to create Stripe account to use the Stripe sandbox. Edit the file config.js and put your Stripe API credentials. 'stripe' : { 'pubkey' : 'YOUR PUBLIC KEY', //account id for stripe - used to create tokens 'key' : 'YOU SECURE KEY', //all api request 'addr' : "https://api.stripe.com/v1/charges" }

  2. You need to create a Mailgun account to use the Mailgun sandbox. Edit the file config.js and put your Mailgun API credentials. 'mailgun' : { 'from' : "Mailgun Sandbox postmaster@sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org", 'key' : "api:YOUR API KEY", 'addr' : "https://api.mailgun.net/v3/sandboxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.mailgun.org/messages" },

  3. You need to supply key.pem and cert.pem and place them in the https folder. The ones that are there are dummy files that you need to replace. To generate the keys, you can use the openssl on your terminal by keying : openssl req -newkey rsa:2048 -new -nodes -keyout key.pem -x509 -days 3650 -out cert.pem.

  4. This program uses hidden directories to store the data. This is the actual directory tree we expect.
    • index.js
    • https/ [where you put you cert.pem and key.pem]
    • lib/ [where you update the config.js with your credentials]
    • .data/
    • .data/menus/
    • .data/tokens/
    • .data/users/
    • .logs/

Go to your application folder, where index.js, and key-in the following command to create them:

  • mkdir .logs
  • mkdir .data
  • cd .data
  • mkdir menus
  • mkdir tokens
  • mkdir users
  • cd ..

When you are done, you can launch : c:\Node\thisApp> node index.js

# API Testing with POSTMAN

# Users

Create User POST / localhost:3000/users Body : { "firstName" : "John", "lastName" : "Smith", "email" : "john@xyz.com", "address" : "park avenue", "password" : "helloword", "tosAgreement" : true }

Query User GET / locahost:3000/users?email=john@xyuz.com Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) }

Delete User DELETE / locahost:3000/users?email=john@xyuz.com Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) }

Update User PUT / localhost:3000/users Body : { "email" : "Johnny", //optional "email" : "john@xyz.com", //mandatory "address" : "royal park avenue", //optional "password" : "hellomyword" //mandatory } Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) }

# Tokens (Session tokens used for continuous authentication)

Create connection token POST / localhost:3000/tokens Body : { "email" : "john@xyz.com", "password" : "helloword" } Response { "email": "john@xyz.com", "id": "2sdnomkcakh1jcjd6o4w", "expires": 1547015683697 }

Query token GET / locahost:3000/id?2sdnomkcakh1jcjd6o4w Response { "email": "john@xyz.com", "id": "2sdnomkcakh1jcjd6o4w", "expires": 1547015683697 }

Delete token DELETE / locahost:3000/id?2sdnomkcakh1jcjd6o4w

Update token PUT / localhost:3000/tokens Body : { ""id": "2sdnomkcakh1jcjd6o4w", "expire" : true or false } if expire is false, we extend the token's life by 60 mins.

# Orders

The restaurant's menu is stored in an internal variable. An order is just an array of indices referencing each menu item and its price.

Create Order POST / localhost:3000/orders Body : { "order" : [0,1,2,3,4,5] } Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) } Response { "id": "8wa0w48hfa4mszs1gv1r", //orderId "userEmail": "john@xyz.com", "order": [ 0, 1, 2, 3, 4, 5 ], "state": "cart" }

Query Menu GET / localhost:3000/orders?id=8wa0w48hfa4mszs1gv1r Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) } Response { "id": "8wa0w48hfa4mszs1gv1r", //orderId "userEmail": "john@xyz.com", "order": [ 0, 1, 2, 3, 4, 5 ], "state": "cart" }

Update Order

  • You cannot update an order which is being processed for payment (state="submitted").
  • In all other cases, the state of the order will be set to "cart" which will make the order available for payments.

PUT / localhost:3000/orders Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) } Body : { "id": "8wa0w48hfa4mszs1gv1r", //orderId "order": [0,1,2] //this list cannot be empty }

Delete an Order

  • It is forbidden to delete a menu which is being processed for payment.
  • Deletes the menu from the user's menu list and from the menus table.
  
DELETE / localhost:3000/orders?id=8wa0w48hfa4mszs1gv1r Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) }

# Pay

  • It is impossible to pay for a menu which is being processed for payment.
  • This module writes the state="submitted" which is exploited by workers to process the payments.

POST / localhost:3000/pay Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) } Body : { "id": "8wa0w48hfa4mszs1gv1r", //orderId }

# Background workers

  • Processes requests for payment
  • Alerts the user
  • Updates the menu state

There are 3 cases here for payment.

  • The total amount < 0.01. This is a "Free Order" and will be deleted from the user and menu tables.
  • The order's associated user is currently invalid. We log this, cancel the payment, reset the menu to "cart".
  • Process the payment. If successful, menu state="paid" and email the client the receipt. If not, menu state="cart".

# GET the menu

  • Only connected users can see the menu

GET / localhost:3000/menu Headers : { token : "v4hma22teaxyji8ncsei" //20 chars connection token (see below on how to create it) } Response menu : { 1 : ["Pizza 1","$1.00"], 2 : ["Pizza 2","$2.00"], 3 : ["Pizza 3","$3.00"], 4 : ["Pizza 4","$4.00"], 5 : ["Pizza 5","$5.00"] }
