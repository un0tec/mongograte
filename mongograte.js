#!/usr/bin/env node --no-warnings=ExperimentalWarning
import { MongoClient } from 'mongodb';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import log4js from 'log4js';
import chalk from 'chalk';
import pkg from './package.json' with {type: 'json'};
import { checkUpdate } from './update-notifier.js';

const argv = yargs(hideBin(process.argv)).exitProcess(false).help(false).parse();

if (argv.skipUpdate !== true) {
    const updateAvailable = await checkUpdate({
        author: pkg.author,
        repository: pkg.repository.name,
        name: pkg.name,
        version: pkg.version
    });

    if (updateAvailable) { process.exit(); }
}

const args = getYargs();
const config = buildConfig(args);
const log = getLogger(config.errorLevel);

log.trace(config);

await migrateDatabases().catch(error => {
    console.error(error.message);
});

function buildConfig(args) {
    return {
        databases: args.databases,
        sourceDB: args.source,
        targetDB: args.target,
        migrateCollections: args.migrateCollections,
        ignoreCollections: args.ignoreCollections,
        drop: args.drop,
        dropAll: args.dropAll,
        truncate: args.truncate,
        limit: args.limit,
        queryLimit: args.queryLimit,
        timeout: args.timeout,
        listen: args.listen,
        insecure: args.insecure,
        skipUpdate: args.skipUpdate,
        verbose: args.verbose,
        errorLevel: args.verbose ? 'TRACE' : 'DEBUG'
    }
}

function getLogger(level = 'DEBUG') {
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
            default: { appenders: ['console'], level: level }
        }
    });

    return log4js.getLogger('console');
}

function getYargs() {
    const yarg = yargs(hideBin(process.argv));
    return yarg.scriptName(pkg.name).usage('Usage: $0 [options]')
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
        .option('migrate-collections', {
            description: 'Collections to migrate from the source database',
            type: 'array'
        })
        .option('ignore-collections', {
            description: 'Collections to exclude from the migration process',
            type: 'array'
        })
        .option('drop', {
            description: 'Drop target collections in the target database',
            type: 'boolean',
            default: false
        })
        .option('drop-all', {
            description: 'Drop all collections in the target database',
            type: 'boolean',
            default: false
        })
        .option('truncate', {
            description: 'Truncate target collections in the target database',
            type: 'boolean',
            default: true
        })
        .option('limit', {
            alias: 'l',
            description: 'Limit of records to be migrated',
            type: 'number',
            default: 1000
        })
        .option('query-limit', {
            description: 'Limit of records per query',
            type: 'number',
            default: 1000
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
        .option('insecure', {
            alias: 'i',
            description: 'Allow use remote database as the target database',
            type: 'boolean',
            default: false
        })
        .option('skip-update', {
            description: 'Skip checking for updates',
            type: 'boolean',
            default: false
        })
        .option('verbose', {
            type: 'boolean',
            default: false
        })
        .check(argv => {
            if (!argv.insecure && argv.target.includes('mongodb.net')) {
                throw new Error(chalk.red('It is not possible to use a remote database as the target database'));
            }
            if (argv.timeout < 1000) {
                throw new Error(chalk.red('Timeout must be greater than 1000 ms'));
            }
            return true;
        })
        .hide('verbose')
        .version(pkg.version).alias('version', 'v')
        .showHelpOnFail(false, 'Specify --help for available options')
        .help().alias('help', 'h')
        .parserConfiguration({
            'short-option-groups': false
        })
        .fail(error => {
            console.error(error);
            console.error();
            yarg.showHelp();
            process.exit(1);
        })
        .argv;
}

async function migrateDatabases() {

    const sourceDbClient = new MongoClient(config.sourceDB, { serverSelectionTimeoutMS: config.timeout });
    const targetDbClient = new MongoClient(config.targetDB, { serverSelectionTimeoutMS: config.timeout });

    try {

        log.debug(`Connecting to source database: ${config.sourceDB}`)
        await sourceDbClient.connect();

        log.debug(`Connecting to target database: ${config.targetDB}`)
        await targetDbClient.connect();

        for (const db of config.databases) {

            migrateDbInitLog(db);

            const sourceDb = sourceDbClient.db(db);
            const targetDb = targetDbClient.db(db);

            if (config.dropAll) {
                await dropAllTargetCollections(targetDb);
            }

            log.debug('Retrieving all collections from the source database')

            let sourceCollections = (await sourceDb.listCollections().toArray()).map(collection => collection.name);

            if (config.migrateCollections) {
                sourceCollections = getUserCollections(sourceCollections);
            }

            if (config.ignoreCollections) {
                sourceCollections = sourceCollections.filter(collection => !config.ignoreCollections.includes(collection))
            }

            sourceCollections.sort();

            log.debug('Collections found: ' + sourceCollections.join(', '));

            for (const name of sourceCollections) {
                const sourceCollection = sourceDb.collection(name);
                const targetCollection = targetDb.collection(name);

                await migrateCollection(sourceCollection, targetCollection);

                if (config.listen) {
                    setupChangeListener(sourceCollection, targetCollection);
                }
            }
        }

    } catch (error) {
        throw new Error(error.message);
    } finally {
        if (!config.listen) {
            await sourceDbClient.close();
            await targetDbClient.close();
        }
    }
}

function getUserCollections(sourceCollections) {
    let nonExistingCollections = config.migrateCollections.filter(collection => !sourceCollections.includes(collection));

    if (nonExistingCollections.length > 0) {
        throw new Error(`The following collections do not exist in the source database: ${nonExistingCollections.join(", ")}`);
    }

    return config.migrateCollections;
}

function migrateDbInitLog(db) {
    const logMessage = `==================== DATABASE ${db} ====================`;
    log.debug('='.repeat(logMessage.length));
    log.debug(logMessage);
    log.debug('='.repeat(logMessage.length));
}

async function migrateCollection(sourceCollection, targetCollection) {
    log.debug(`Migrating ${sourceCollection.collectionName}`);

    if (!config.dropAll && config.drop) {
        await targetCollection.drop();
    } else if (config.truncate) {
        await targetCollection.deleteMany({});
    }

    log.debug(`    Deleted?: ${(config.dropAll || config.drop) ? 'yes' : 'no'}`);
    log.debug(`    Truncated?: ${(!config.dropAll && !config.drop && config.truncate) ? 'yes' : 'no'}`);
    log.debug('    Records: ' + (await sourceCollection.countDocuments()));

    const documents = [];
    const BATCH_SIZE = config.queryLimit;
    const cursor = sourceCollection.find().limit(config.limit).batchSize(BATCH_SIZE);
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
}

async function dropAllTargetCollections(targetDb) {

    log.debug('Retrieving all collections from the target database');
    const targetCollectionsNames = (await targetDb.listCollections().toArray()).map(collection => collection.name);
    targetCollectionsNames.sort();

    if (targetCollectionsNames.length == 0) {
        log.debug('No collections found, they will be created automatically');
        return;
    }

    log.debug('Collections found: ' + targetCollectionsNames.join(', '));

    log.debug('Dropping all collections in the target database');

    for (const name of targetCollectionsNames) {
        await targetDb.collection(name).drop();
        log.debug(`Collection deleted: ${name}`);
    }

}

function setupChangeListener(sourceCollection, targetCollection) {
    log.debug(`    Listening changes in: ${sourceCollection.dbName}|${sourceCollection.collectionName}`);
    const changeStream = sourceCollection.watch();

    changeStream.on('change', async (change) => {
        log.debug(`Change detected in ${sourceCollection.dbName}|${sourceCollection.collectionName}: `, change);

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
