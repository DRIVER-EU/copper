# CsNext Copper



### Build docker image

To create a docker images for copper server and webserver, execute:

`Docker-compose build`

### Running in docker

After the docker images are created, the images can be activated with:

`Docker-compse up -d`

By default the web interface is: http://127.0.0.1:8080 and the COPPR server interface is http://127.0.0.1:3007/api

## Creating non-existing topics

In case a topic does not exist, the Kafka adapter cannot start. You can either send a message to the topic (so it gets created), use the admin tool, or use the CLI, e.g.

`kafka-topics --create --topic simulation_entity_item --bootstrap-server localhost:3501 --partitions 1 --replication-factor 1`
