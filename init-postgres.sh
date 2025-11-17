#!/bin/bash
set -e

# Usar variables de entorno
DB_USER="${DB_USER:-blackjack_user}"
DB_PASSWORD="${DB_PASSWORD:-blackjack_pass}"

# Crear usuario
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    CREATE DATABASE blackjack_auth;
    CREATE DATABASE blackjack_main;
    CREATE DATABASE blackjack_game;
    GRANT ALL PRIVILEGES ON DATABASE blackjack_auth TO $DB_USER;
    GRANT ALL PRIVILEGES ON DATABASE blackjack_main TO $DB_USER;
    GRANT ALL PRIVILEGES ON DATABASE blackjack_game TO $DB_USER;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "blackjack_game" <<-EOSQL2
    GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;
EOSQL2
