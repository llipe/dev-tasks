# System Architecture

## Overview

The platform consists of microservices organized by domain.

## Domains

- **identity**: Authentication and user management
- **messaging**: Notifications and communication

## Communication Patterns

Services communicate via REST APIs and async events (Kafka).

## Data Stores

Each service owns its database (database-per-service pattern).
