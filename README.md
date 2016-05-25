# Doctor Rest
[![Build Status](https://travis-ci.org/matobet/doctor-rest.svg?branch=master)](https://travis-ci.org/matobet/doctor-rest)
[![Coverage Status](https://coveralls.io/repos/matobet/doctor-rest/badge.svg?branch=master&service=github&github_cache=suxx)](https://coveralls.io/github/matobet/doctor-rest?branch=master)
[![bitHound Overall Score](https://www.bithound.io/github/matobet/doctor-rest/badges/score.svg)](https://www.bithound.io/github/matobet/doctor-rest)
![Dependency Status](https://david-dm.org/matobet/doctor-rest.svg)

Generic proxy for REST-ful APIs with custom query language and MQTT push notifications.

## Description

Doctor Rest (short from **DOC**umen**T** **OR**iented REST) is a generic microservice with simple REST-ful API that enables external connectors to store documents in it and Doctor will make sure to properly
diff the documents and publish changes on appropriate MQTT topics using embedded MQTT broker.

In addition to push support it leverages the fact that to diff the documents we have to store them somewhere
(currently MongoDB) and provides simple language to query the documents.

## Running

To run doctor simply

    npm install
    npm start

### Docker

To avoid having to install io.js and npm dependencies a docker image is available. Just make sure to expose ports for Doctor Rest API and MQTT (default 3000 and 1883).

    docker run -it -p 3000 -p 1883 --net=host matobet/doctor-rest

For both docker and non-docker runs a running instance of MongoDB is required. By default running on localhost on port 27017.

You can also specify several environment variables to configure Doctor's behavior. All except `SECRET` have
reasonable default values.

* SECRET - shared secret to be used by *Connector*'s to invoke privileged operations
* MONGO_HOST - host[:port] where mongo server is running
* MONGO_MAIN_DB - mongo database to be used
* API_PORT - port for Doctor REST API
* MQTT_PORT - port for embedded MQTT broker
* CLUSTERED - fork worker process per each CPU core [0|1] default 0
