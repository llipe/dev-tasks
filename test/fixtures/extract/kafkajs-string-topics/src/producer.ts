import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

export async function publishOrder(data: string) {
  await producer.send({
    topic: "order-events",
    messages: [{ value: data }],
  });
}

export async function publishBatch() {
  await producer.sendBatch({
    topicMessages: [
      { topic: "payment-events", messages: [{ value: "paid" }] },
      { topic: "notification-events", messages: [{ value: "notified" }] },
    ],
  });
}
