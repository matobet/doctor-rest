# Doctor Rest
[![Build Status](https://travis-ci.org/matobet/doctor-rest.svg?branch=master)](https://travis-ci.org/matobet/doctor-rest)
[![Coverage Status](https://coveralls.io/repos/matobet/doctor-rest/badge.svg?branch=master&service=github&github_cache=suxx)](https://coveralls.io/github/matobet/doctor-rest?branch=master)

Generic proxy for REST-ful APIs with custom query language and MQTT push notifications.

## Description

Doctor Rest (short from **DOC**umen**T** **OR**iented REST) is a generic microservice with simple REST-ful API that enables external connectors to throw documents at it and Doctor will make sure to properly
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

## Main Concepts
* **Document**  a thing (JSON document) of value that will be stored and diffed by Doctor
* **Session**   an abstract representation of logged in user (permissions are validated with respect to sessions)
* **Connector** external agent that is responsible for updating the *Documents* and *Sessions*. Has privileged access to doctor.

## Documents

Document is any JSON object that contains the `id` attribute and fields with some restrictions.
The field name may not contain `'.', '@' ` or start with `'_'`.
Nested documents are supported but in case of change the push notifications will be generated only for the top level key.

Documents are grouped into collections (terminology similar to underlying MongoDB). Thanks to Doctor's generic approach the structure and content of documents is purely defined by the connector. To ease explanation we will use sample entities from the [oVirt project](http://www.ovirt.org), e.g. VMs, Clusters, DataCenters...

### Example Documents

Cluster:

    {
        "id": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1",
        "name": "Default",
        "version/major": 3,
        "version/minor": 6
    }

VM:

    {
        "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
        "name": "vm1",
        "status": "up"
        "cluster": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1",
        "template": "00000000-0000-0000-0000-000000000000",
        "disk": ["disk_id_1", "disk_id_2"]
    }


### Creating & Updating Documents

All manipulation with Doctor's entity collection is done using the REST endpoint `/entities`. The individual collections are then identified by singular name of entity - e.g `/entities/vm` or `/entities/cluster`. Note that the connector doesn't need to specify the "schema" of these collections beforehand. Just push new data and doctor will create the underlying collection as needed.

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
        "exit_reason": "Admin Shutdown",
        "cluster": "00000002-0002-0002-0002-000000000189"
    }

When document is updated whether using `PUT` or `PATCH`, the real diff is computed and names of properties of document that have actually changed are broadcast on the document's topic (comma separated):

    topic='vm/1963c0f2-2490-4810-a66f-0e76d81ebea2' payload='status,exit_reason,cluster'

### Document Removed

    DELETE /entities/vm/

Similarly to document creation, removal results in simplified broadcast

    topic='vm/1963c0f2-2490-4810-a66f-0e76d81ebea2' payload='-'


### Bulk Operations
In case of bulk operation the diff is made for each individual document and appropriate creation/modification/removal broadcasts are made for each document (and on each respective topic corresponding to given document).

## Query Capabilities

To simply get all documents of given type you would probably expect

    GET /entities/vm

to work and indeed it does. Similarly to get specific document

    GET /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2

But these most basic `GET`'s return the whole documents in their entirety. To be more specific and query just the fields you are interested in we introduce the selector object.

    {
        "select": ["id", "name", "status"]
    }

It is an object that may be specified either as a body of the `GET` request (which many clients don't support) or as a query parameter:

    GET /entities/vm?q={"select": ["id", "name", "status"]}

Where the exact same JSON object is serialized as the value of the `q` query parameter.

### Document References

In addition to selecting direct fields of given document, the selector syntax supports aggregation of data from related documents.
There are two basic types of references: one-to-one and one-to-many.

#### One-to-One references

One to one referene is the case when a document contains as a link a single id to different document. For example VM may contain cluster id or a cluster may in turn contain storage domain id.
When querying one-to-one references the field containing the id of linked document will be prefixed by `@`.

Example dataset:

Data Center

    POST /entities/data_center
    {
        "id": "00000001-0001-0001-0001-0000000002bb",
        "name": "Default DC",
        "version": "3.5"
    }

Cluster

    POST /entities/cluster
    {
        "id": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1",
        "name": "Default",
        "version": "3.6",
        "data_center": "00000001-0001-0001-0001-0000000002bb"
    }

VM

    POST /entities/vm
    {
        "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
        "name": "vm1",
        "status": "up",
        "cluster": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1"
    }

The simplest case is when we want to query individual fields from referenced documents, for example to get all VMs with names of cluster and cluster's data center.

    GET /entities/vm?q={"select": ["id", "name", "@cluster.name", "@cluster.@data_center.name"]}

This will return VM documents embedded with required referenced fields. Note that these fields will be named using the path
used to reference given value. This example utilizes two one-to-one relationships (`vm->cluster` and `cluster->data_center`).
Doctor supports resolution of such relationships to arbitrary depth.

    [{
        "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
        "name": "vm1",
        "@cluster.name": "Default",
        "@cluster.@data_center.name": "Default DC"
    }]

In cases when we explicitly select referential fields in addition to whole document a special field selector `"*"` is supported, so the client doesn't need to
specify all fields manually. Example:

    GET /entities/vm/1963c0f2-2490-4810-a66f-0e76d81ebea2?q={"select": ["*", "@cluster.name""]}

will return

    {
        "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
        "name": "vm1",
        "status": "up",
        "cluster": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1"
        "@cluster.name": "Default"
    }

##### Embedding References

In the first example we queried two independent properties of VM's cluster (it's `name` and `@data_center.name`). In cases like this it may be useful to embed whole referenced documents into the respnse. Example:

    GET /entities/vm?q={"select": ["name", "status", "@cluster"]}

will return

    [{
        "name": "vm1",
        "status": "up",
        "@cluster": {
            "id": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1",
            "name": "Default",
            "version": "3.6",
            "data_center": "00000001-0001-0001-0001-0000000002bb"
        }
    }]

But sometimes embedding the entire (possibly large) document may not be desirable. To maintain this grouped structure provided by embedding references while preserving the power to select only given fields of the referenced document, the following syntax is supported:

    GET /entities/vm?q={"select": ["name", "status", "@cluster(name, @data_center.name)"]}

which will return

    [{
        "name": "vm1",
        "status": "up",
        "@cluster": {
            "name": "Default",
            "@data_center.name": "Default DC"
        }
    }]

Inside the `( )` one can specify a comma separated list of selectors (that will be relative to currently embedded object) and again full power of selectors is supported (and to arbitrary depth).

#### One-to-Many references

The other type of supported relationship is One-To-Many. One-To-Many relationship may arise in two ways. First case is that document directly contains array of ID's
in its field named after singular form of the linked collection (can be seen in very first example of VM document - disk).
The second case arises when multiple documents have same One-to-One reference to same
document. For example when multiple VMs point to same Cluster document, we may query the Cluster's VMs.

In both cases the syntax is the same: `@[<referenced_name>]`. Notice the additional `[ ]` around the reference name compared to one-to-one references. Example:

    GET /entities/cluster?q={"select": ["name", "version", "@[vm]"]}

will return:

    [{
        "name": "Default",
        "version": "3.6",
        "@[vm]": [{
            "id": "1963c0f2-2490-4810-a66f-0e76d81ebea2",
            "name": "vm1",
            "status": "up",
            "cluster": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1"
        }]
    }]

Again field projections are supported so

    GET /entities/cluster?q={"select": ["name", "version", "@[vm](name, status)"]}

will return

    [{
        "name": "Default",
        "version": "3.6",
        "@[vm]": [{
            "name": "vm1",
            "status": "up",
        }]
    }]

The simplified case where we wanted to query just `@cluster.name` for VM also works in One-to-Many relationships. In this case

    GET /entities/cluster?q={"select": ["name", "version", "@[vm].name"]}

will return embedded array of VM names

    [{
        "name": "Default",
        "version": "3.6",
        "@[vm].name": ["vm1"]
    }]

Again arbitrary nesting of all above features is supported so to query data centers with embedded list of clusters
where each cluster will contain aggregated VM names and statuses and list of disk names.

But first let's create the missing disks:

    PUT /entities/disk
    [{
        "id": 1,
        "name": "My Disk 1",
        "size": 1024,
        "vm": "1963c0f2-2490-4810-a66f-0e76d81ebea2"
    }, {
        "id": 2,
        "name": "My Disk 2",
        "size": 2048,
        "vm": "1963c0f2-2490-4810-a66f-0e76d81ebea2"
    }]

and now

    GET /entities/data_center?q={"select": ["*", "@[cluster](name, version, @[vm](name, status, @[disk].name))"]}

will return

    [{
        "id": "00000001-0001-0001-0001-0000000002bb",
        "name": "Default DC",
        "version": "3.5",
        "@[cluster]": [{
            "name": "Default",
            "@[vm]": [{
                "name": "vm1",
                "status": "up",
                "@[disk].name": ["My Disk 1", "My Disk 2"]
            }]
         }]
    }]


## Security

Doctor Rest enables in addition to *Documents* also to track logged in user *Sessions*. Doctor is designed to be consumed primarily
by frontend applications and frontend applications usually require some form of authentication and/or role based access control.

To simplify implementation and maintain the largest degree of universality, doctor tracks only individual sessions and validates
permissions to read documents with respect to those sessions. It is the responsibility of the *Connector* to manage Doctor Sessions.


Connector can access the permissions at the endpoint `/sessions` and do typical CRUD operations. Similarly to documents, each
session is required to have unique ID.

### Permissions

A session that can be used to `GET` documents from doctor needs to also contain `permissions` object.

The `permissions` object serves as a whitelist (with optional wildcards) of documents that this *Session* access.

Example:

    POST /sessions
    {
        "id": 1,
        "permissions": {
            "vm": "1963c0f2-2490-4810-a66f-0e76d81ebea2"
        }
    }

This will create session that can access single VM.

Permissions object can contain multiple document collection names, for example to access a specific 2 VMs and one specific cluster the permissions object would look like

    "permissions: {
        "vm": ["1963c0f2-2490-4810-a66f-0e76d81ebea2", "ef1d94b9-c4d5-4e3b-addf-7bb57d6a91f9"],
        "cluster": "44c687d0-0ac5-4e2d-b17b-9cff5681f7b1"
    }

When a session can access all documents of given type, the `"*"` wildcard can be used as follows:

    "permissions: {
        "template": "*"
    }

This session will be able to access all Templates (but nothing else).

In case an Administrator user is logged in (that can access all of system), we can simplify the permission object even
further by specifying wildcard at the root of permissions object:

    "permissions": "*"

These sessions are then utilized by the client that actually requests the documents by specifying the `SESSION` header
of the request with the value of session id.

### Connector Privilege

Independent of the per-document permissions facilitated by sessions & permissions stands the authentication of *Connector* against Doctor.
Connector is the agent that is able to manage sessions and issue non-`GET` requests, so it's security is handled separately.

Upon start, Doctor Rest will read an environment variable `SECRET` that will be shared between Doctor and Connector. Connector must include the value of the shared
secret in the `SECRET` header to be able to execute privileged operations.

In case the `SECRET` environment variable is not specified when starting Doctor, it will be started in **unsecured** mode where all operations are public.
