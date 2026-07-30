import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

// Opaque: Buffer payload
export async function publishBinary(data: Buffer) {
  await producer.send({
    topic: "binary-events",
    messages: [{ value: data }],
  });
}

// Opaque: JSON.stringify with untyped variable
export async function publishDynamic(payload: any) {
  await producer.send({
    topic: "dynamic-events",
    messages: [{ value: JSON.stringify(payload) }],
  });
}

// Producer with no consumers in same repo
export async function publishOrphan() {
  await producer.send({
    topic: "orphan-topic",
    messages: [{ value: JSON.stringify({ orphan: true }) }],
  });
}
