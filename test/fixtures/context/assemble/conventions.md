# Conventions

## API Design

- All REST APIs use JSON and follow OpenAPI 3.x.
- Error responses use RFC 7807 problem details.
- Authentication via Bearer JWT tokens.

## Naming

- Service names: kebab-case
- Contract ids: kebab-case matching the service + suffix

## Testing

- Unit test coverage >= 80%
- Integration tests for all API endpoints
