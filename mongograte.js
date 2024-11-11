const { MongoClient } = require('mongodb');
const yargs = require('yargs');
const log4js = require('log4js');

const args = yargs
    .scriptName("mongograte")
    .usage('Usage: $0 [options]')
    .option('databases', {
        alias: 'd',
        description: 'Target databases',
        type: 'array',
        demandOption: true,
    })
    .option('source', {
        alias: 's',
        description: 'Source server uri',
        type: 'string',
        demandOption: true,
    })
    .option('target', {
        alias: 't',
        description: 'Target server uri',
        type: 'string',
        demandOption: true,
    })
    .option('clear', {
        alias: 'c',
        description: 'Drop collections in the target database',
        type: 'boolean',
        default: false
    })
    .option('limit', {
        alias: 'l',
        description: 'Limit of records to be migrated',
        type: 'number',
        default: 1000
    })
    .option('verbose', {
        type: 'boolean',
        default: false
    })
    .option('insecure', {
        alias: 'i',
        description: 'Allow use remote database as the target database',
        type: 'boolean',
        default: false
    })
    .option('timeout', {
        description: 'Allows increasing the default timeout (ms)',
        type: 'number',
        default: 5000
    })
    .option('listen', {
        description: 'Listen changes in target databases|collections',
        type: 'boolean',
        default: false
    })
    .hide('verbose')
    .version('1.0.0')
    .alias('version', 'v')
    .showHelpOnFail(false, 'Specify --help for available options')
    .help()
    .alias('help', 'h')
    .fail(msg => {
        console.error(msg);
        console.error();
        yargs.showHelp();
        process.exit(1);
    })
    .argv;

const clearCollections = args.clear;
const databases = args.databases;
const limit = args.limit;
const sourceDB = args.source;
const targetDB = args.target;
const insecure = args.insecure;
const timeout = args.timeout;
const listen = args.listen;

const errorLevel = args.verbose ? 'TRACE' : 'DEBUG';

log4js.configure({
    appenders: {
        console: {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%[[%d{hh:mm:ss}]%] %[[%p]%] - %m'
            }
        }
    },
    categories: {
        default: { appenders: ['console'], level: errorLevel }
    }
});

const log = log4js.getLogger('console');

if (!insecure && targetDB.includes('mongodb.net')) {
    log.error('It is not possible to use a remote database as the target database');
    process.exit(1);
}

log.trace(args);

syncDatabases().catch(error => {
    log.error(error.message);
    process.exit(1);
});

async function syncDatabases() {

    const sourceDbClient = new MongoClient(sourceDB, { serverSelectionTimeoutMS: timeout });
    const targetDbClient = new MongoClient(targetDB, { serverSelectionTimeoutMS: timeout });

    try {

        log.debug(`Connecting to source database: ${sourceDB}`)
        await sourceDbClient.connect();

        log.debug(`Connecting to target database: ${targetDB}`)
        await targetDbClient.connect();

        for (const db of databases) {

            log.debug(`==================== DATABASE ${db} ====================`)

            const sourceDb = sourceDbClient.db(db);
            const targetDb = targetDbClient.db(db);

            if (clearCollections) {

                log.debug('Retrieving all collections from the target database')
                const targetCollections = await targetDb.listCollections().toArray();

                if (targetCollections.length > 0) {
                    log.debug('Collections found: ' + targetCollections.map(d => d.name).join(', '));

                    log.debug('Clearing all collections in the target database');
                    for (const { name } of targetCollections) {
                        await targetDb.collection(name).drop();
                        log.debug(`Colection deleted: ${name}`);
                    }
                } else {
                    log.debug('No collections found, they will be created automatically');
                }
            }

            log.debug('Retrieving all collections from the source database')
            const sourceCollections = await sourceDb.listCollections().toArray();
            log.debug('Collections found: ' + sourceCollections.map(d => d.name).join(', '));

            for (const { name } of sourceCollections) {
                const sourceCollection = sourceDb.collection(name);
                const targetCollection = targetDb.collection(name);

                log.debug(`Syncing ${name}`);
                log.debug('    Records: ' + (await sourceCollection.countDocuments()));

                const documents = [];
                const BATCH_SIZE = 1000;
                const cursor = sourceCollection.find().limit(limit).batchSize(BATCH_SIZE);
                let count = 0;

                while (await cursor.hasNext()) {
                    const document = await cursor.next();
                    documents.push(document);
                    count++;

                    if (documents.length === BATCH_SIZE) {
                        await targetCollection.insertMany(documents);
                        log.debug(`    Documents migrated: ${count}`);
                        documents.length = 0;
                    }
                }

                if (documents.length > 0) {
                    await targetCollection.insertMany(documents);
                    log.debug(`    Documents migrated: ${documents.length}`);
                }

                if (listen) {
                    log.debug(`    Listening changes in: ${db}|${name}`);
                    const changeStream = sourceCollection.watch();

                    changeStream.on('change', async (change) => {
                        log.debug(`Change detected in ${db}|${name}: `, change);

                        switch (change.operationType) {
                            case 'insert':
                                await targetCollection.insertOne(change.fullDocument);
                                break;
                            case 'update':
                                await targetCollection.updateOne(
                                    { _id: change.documentKey._id },
                                    { $set: change.updateDescription.updatedFields }
                                );
                                break;
                            case 'replace':
                                await targetCollection.replaceOne(
                                    { _id: change.documentKey._id },
                                    change.fullDocument
                                );
                                break;
                            case 'delete':
                                await targetCollection.deleteOne({ _id: change.documentKey._id });
                                break;
                            default:
                                log.debug(`Operation not supported: ${change.operationType}`);
                        }
                    });
                }
            }
        }

    } catch (error) {
        log.error(error.message);
    } finally {
        if (!listen) {
            sourceDbClient.close();
            targetDbClient.close();
        }
    }
}
