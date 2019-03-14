package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"runtime/pprof"

	"github.com/decred/slog"
	"github.com/picfight/pfcd/rpcclient"
	"github.com/picfight/pfcdata/v3/db/pfcsqlite"
	"github.com/picfight/pfcdata/v3/rpcutils"
	"github.com/picfight/pfcdata/v3/stakedb"
)

var (
	backendLog      *slog.Backend
	rpcclientLogger slog.Logger
	sqliteLogger    slog.Logger
	stakedbLogger   slog.Logger
)

func init() {
	err := InitLogger()
	if err != nil {
		fmt.Printf("Unable to start logger: %v", err)
		os.Exit(1)
	}
	backendLog = slog.NewBackend(log.Writer())
	rpcclientLogger = backendLog.Logger("RPC")
	rpcclient.UseLogger(rpcclientLogger)
	sqliteLogger = backendLog.Logger("DSQL")
	pfcsqlite.UseLogger(rpcclientLogger)
	stakedbLogger = backendLog.Logger("SKDB")
	stakedb.UseLogger(stakedbLogger)
}

func mainCore() int {
	// Parse the configuration file, and setup logger.
	cfg, err := loadConfig()
	if err != nil {
		fmt.Printf("Failed to load pfcdata config: %s\n", err.Error())
		return 1
	}

	if cfg.CPUProfile != "" {
		f, err := os.Create(cfg.CPUProfile)
		if err != nil {
			log.Fatal(err)
			return -1
		}
		pprof.StartCPUProfile(f)
		defer pprof.StopCPUProfile()
	}

	// Connect to node RPC server
	client, _, err := rpcutils.ConnectNodeRPC(cfg.PfcdServ, cfg.PfcdUser,
		cfg.PfcdPass, cfg.PfcdCert, cfg.DisableDaemonTLS)
	if err != nil {
		log.Fatalf("Unable to connect to RPC server: %v", err)
		return 1
	}

	infoResult, err := client.GetInfo()
	if err != nil {
		log.Errorf("GetInfo failed: %v", err)
		return 1
	}
	log.Info("Node connection count: ", infoResult.Connections)

	_, _, err = client.GetBestBlock()
	if err != nil {
		log.Error("GetBestBlock failed: ", err)
		return 2
	}

	// Sqlite output
	dbInfo := pfcsqlite.DBInfo{FileName: cfg.DBFileName}
	//sqliteDB, err := pfcsqlite.InitDB(&dbInfo)
	sqliteDB, cleanupDB, err := pfcsqlite.InitWiredDB(&dbInfo, nil, client,
		activeChain, "rebuild_data", true)
	defer cleanupDB()
	if err != nil {
		log.Errorf("Unable to initialize SQLite database: %v", err)
	}
	log.Infof("SQLite DB successfully opened: %s", cfg.DBFileName)
	defer sqliteDB.Close()

	// Ctrl-C to shut down.
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)

	ctx, cancel := context.WithCancel(context.Background())

	// Start waiting for the interrupt signal.
	go func() {
		<-c
		cancel()
		for range c {
			log.Info("Shutdown signaled. Already shutting down...")
		}
	}()

	// Resync db
	var height int64
	height, err = sqliteDB.SyncDB(ctx, nil, 0)
	if err != nil {
		log.Error(err)
	}

	log.Printf("Done at height %d!", height)

	return 0
}

func main() {
	os.Exit(mainCore())
}
