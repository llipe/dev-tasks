# Database Schema

## Order

| Column    | Type        | Nullable | Key |
| --------- | ----------- | -------- | --- |
| id        | String      | no       | PK  |
| userId    | String      | no       |     |
| total     | Float       | no       |     |
| status    | OrderStatus | no       |     |
| createdAt | DateTime    | no       |     |

## OrderStatus (enum)

- PENDING
- CONFIRMED
- SHIPPED
- DELIVERED
