import { Kafka } from "kafkajs";

interface OrderEvent {
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface UserEvent {
  userId: string;
  email: string;
  action: string;
}

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

export async function publishOrderEvent(event: OrderEvent) {
  await producer.send({
    topic: "order-events",
    messages: [{ value: JSON.stringify(event) }],
  });
}

export async function publishUserEvent(event: UserEvent) {
  await producer.send({
    topic: "user-events",
    messages: [{ value: JSON.stringify(event) }],
  });
}
