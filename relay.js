const { Relay } = require("bedrock-protocol");
const { writeFileSync, mkdirSync } = require("fs");
const path = require("path");

const options = {
    host: "127.0.0.1",
    port: 19132,
    // offline: true,
    profilesFolder: "./msa",
    destination: {
        host: "127.0.0.1",
        port: 19130,
    },
};

const ignoreLog = {
    clientbound: ["network_chunk_publisher_update", "set_entity_data", "move_entity_delta", "level_chunk"],
    serverbound: [],
};
const ignoreFile = { clientbound: [], serverbound: [] };

console.log(`Creating relay to ${options.destination.host}:${options.destination.port}.`);

const relay = new Relay(options);
relay.listen();

console.log(`Relay listening on port ${options.port}.`);

console.log("Starting packet logging...");
console.log(`Not logging clientbound packets to console: ${ignoreLog.clientbound.join(", ")}`);
console.log(`Not logging serverbound packets to console: ${ignoreLog.serverbound.join(", ")}`);
console.log(`Not writing clientbound packets to file: ${ignoreFile.clientbound.join(", ")}`);
console.log(`Not writing serverbound packets to file: ${ignoreFile.serverbound.join(", ")}`);

relay.on("join", (player) => {
    console.log(`Player ${player.username ?? player.profile.username} joined from ${player.host}`);

    const clientboundPackets = [];
    const serverboundPackets = [];

    player.on("clientbound", ({ name, params }) => {
        if (!ignoreLog.clientbound.includes(name))
            (async () => console.log(`[-> C] Recieved Clientbound packet ${name}`))();

        if (!ignoreFile.clientbound.includes(name))
            clientboundPackets.push({ type: "clientbound", name, params, time: Date.now() });
    });

    player.on("serverbound", ({ name, params }) => {
        if (!ignoreLog.serverbound.includes(name))
            (async () => console.log(`[S <-] Recieved Serverbound packet ${name}`))();

        if (!ignoreFile.serverbound.includes(name))
            serverboundPackets.push({ type: "serverbound", name, params, time: Date.now() });
    });

    player.on("close", () => {
        const packetLog = [...clientboundPackets, ...serverboundPackets].sort((a, b) => a.time - b.time);
        const dir = path.join(__dirname, "logs/log_" + new Date().toLocaleString().replace(/[/, :]+/g, "-"));
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            path.join(dir, "packets.log"),
            packetLog.map(({ type, name, time }) => `[${time}] ${type}: ${name}`).join("\n")
        );
        writeFileSync(
            path.join(dir, "packet_names.json"),
            JSON.stringify(
                packetLog.map(({ type, name, time }) => ({ time, type, name })),
                null,
                4
            )
        );
        writeFileSync(
            path.join(dir, "packet_params.json"),
            JSON.stringify(packetLog, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
        );
    });
});
