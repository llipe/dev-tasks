import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "worker-group" });

export async function startConsumer(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: "events", fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ message }) => {
      console.log(message.value?.toString());
    },
  });
}
