#!/bin/bash

docker run --env-file .env --rm -v $(pwd)/restaurants.json:/data/restaurants.json meitre-cron