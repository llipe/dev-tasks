import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "order-group" });

export async function startConsumer() {
  await consumer.subscribe({ topic: "order-events" });
  await consumer.subscribe({ topics: ["payment-events", "shipping-events"] });

  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log(message.value?.toString());
    },
  });
}
