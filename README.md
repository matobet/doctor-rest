# Doctor Rest
[![Build Status](https://travis-ci.org/matobet/doctor-rest.svg?branch=master)](https://travis-ci.org/matobet/doctor-rest)

Generic proxy for REST-ful APIs with custom query language and MQTT push notifications.

## Description

Doctor Rest (short from **DOC**umen**T** **OR**iented REST) is a generic microservice with simple REST-ful API that enables external connectors to throw documents at it and Doctor will make sure to properly
diff the documents and publish changes on appropriate MQTT topics using embedded MQTT broker. 

In addition to push support it leverages the fact that to diff the documents we have to store them somewhere
(currently MongoDB) and provides simple language to query the documents.

## Main Concepts
* **Document**  a thing (JSON document) of value that will be stored and diffed by Doctor
* **Session**   an abstract representation of logged in user (permissions are validated with respect to sessions)
* **Connector** external agent that is responsible for updating the *Documents* and *Sessions*. Has privileged access to doctor.

## Documents

Document is any JSON object that contains the `id` attribute and fields with some restrictions.
The field name may not contain `'.', '@' ` or start with `'_'` and currently nested objects are not supported (i.e. the document has to contain only flat structure of key: value pairs where value is not object or array).

Documents are grouped into collections (terminology similar to underlying MongoDB). Thanks to Doctor's generic approach the structure and content of documents is purely defined by the connector. To ease explanation we will use sample entities from the [oVirt project](www.ovirt.org), e.g. VMs, Clusters, DataCenters...

All manipulation with Doctor's entity collection is done using the REST endpoint `/entities`. The individual collections are then identified by singular name of entity - e.g `/entities/vm` or `/entities/cluster`. Note that the connector doesn't need to specify the "schema" of these collections beforehand. Just push new data and doctor will create the underlying collection as needed.

### Creating & Updating Documents

Let's create a new VM

    POST /entities/vm
    {
       "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
       "name": "vm1",
       "status": "up"
    }

this is the simplest way to add a single document to a collection.

Doctor also supports bulk operations for connectors that are doing for example bulk updates, periodic dumps from other database etc.

    PUT /entities/vm
    [{
       "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
       "name": "vm1",
       "status": "up"
    }, {
       "id": "2c96d966-6560-48c9-be05-74c2f262e211",
       "name": "vm2",
       "status": "down"
    }, {
       "id": "1a65c0f2-1145-4810-a66f-eee541ebea2",
       "name": "vm3",
       "status": "unknown"
    }]
    
The `PUT` operation will replace content of entire collection thus destroying all old values.

To update a specific document simply

    PUT /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2
    {
       "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
       "name": "vm1",
       "status": "down"
    }

This will do a full replace of a single document. If the document doesn't exist yet it will be created first. This behavior comes in handy for connectors that periodically `PUT` new version of entire documents and don't need to specially handle the first occurence of the document. `PUT /entities/{name}/{id}` always works.

Even when doing full replaces, the Doctor is smart enough to publish only updates for fields that have actually changed. But if the connector wants to explicitly do a partial update of a specific document, it can do that with

    PATCH /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2
    {
        "status": "down"
    }
    
To delete a single documents simply

    DELETE /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2

Dropping the entire document collection is similar

    DELETE /entities/vm
    

Plese note that all entity operations with HTTP verbs `POST`, `PUT`, `PATCH` and `DELETE` are privileged to the connector and require the `SECRET` header to be set.

## Push Notifications

When documents are created, changed and removed Doctor publishes notifications about these events using MQTT protocol. MQTT messages consist of a string name of topic and an arbitrary binary payload. Doctor maps document updates to topics as follows:

### Document Created

    POST /entities/vm
    {
       "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
       "name": "vm1",
       "status": "up"
    }

When a document is created whether using `POST` or `PUT` a string with content "+" is broadcast on topic constructed using document collection name and document id. 
MQTT broadcast: 

    topic='vm/1963c0f2-2490-4810-a66f-0e76d81ebea2' payload='+'

#### Document Updated

    PATCH /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2
    {
        "name": "vm1",
        "status": "down",
        "exit_reason": "Admin Shutdown"
    }

When document is updated whether using `PUT` or `PATCH`, the real diff is computed and names of properties of document that have actually changed are broadcast on the document's topic (comma separated):

    topic='vm/1963c0f2-2490-4810-a66f-0e76d81ebea2' payload='status,exit_reason'

### Document Removed

    DELETE /entities/vm/

Similarly to document creation, removal results in simplified broadcast

    topic='vm/1963c0f2-2490-4810-a66f-0e76d81ebea2' payload='-'

### Bulk Operations
In case of bulk operation the diff is made for each individual document and appropriate creation/modification/removal broadcasts are made for each document (and on each respective topic corresponding to given document).
