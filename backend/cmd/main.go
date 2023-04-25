package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"sort"

	"github.com/btcsuite/btcd/btcjson"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/rpcclient"
	"github.com/btcsuite/btcutil"
	"github.com/rs/cors"
)

type RPCRequest struct {
	ID      int64         `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params,omitempty"`
	Jsonrpc string        `json:"jsonrpc"`
}

type RPCResponse struct {
	ID     int64           `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *RPCError       `json:"error"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Transaction struct {
	TxID          string  `json:"txid"`
	Blockhash     string  `json:"blockhash"`
	Blockheight   int64   `json:"blockheight"`
	N             int     `json:"n"`
	Value         float64 `json:"value"`
	Asm           string  `json:"asm"`
	ScriptHex     string  `json:"scriptHex"` // Rename this field
	ReqSigs       int     `json:"reqSigs"`
	Confirmations int     `json:"confirmations"`
}

func callRPC(requestBody interface{}) (*RPCResponse, error) {
	url := "http://localhost:18332"

	user := "bitcoin"
	password := "bitcoin"

	data, err := json.Marshal(requestBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(user, password)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseData, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var response RPCResponse
	err = json.Unmarshal(responseData, &response)
	if err != nil {
		return nil, err
	}

	if response.Error != nil {
		return nil, response.Error
	}

	return &response, nil
}

func (e *RPCError) Error() string {
	return fmt.Sprintf("RPC Error %d: %s", e.Code, e.Message)
}

func optionsHandler(w http.ResponseWriter, r *http.Request) {

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
}

func generateKeyPairHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("CORS headers enabled")

	req := RPCRequest{
		ID:      1,
		Method:  "getnewaddress",
		Jsonrpc: "1.0",
	}

	var response *RPCResponse
	response, err := callRPC(req)
	if err != nil {
		log.Println("Error retrieving address from RPC:", err)
		http.Error(w, "Failed to retrieve address", http.StatusInternalServerError)
		return
	}

	var address string
	err = json.Unmarshal(response.Result, &address)
	if err != nil {
		log.Println("Error unmarshaling address:", err)
		http.Error(w, "Failed to parse address", http.StatusInternalServerError)
		return
	}

	req = RPCRequest{
		ID:      2,
		Method:  "dumpprivkey",
		Params:  []interface{}{address},
		Jsonrpc: "1.0",
	}

	response, err = callRPC(req)
	if err != nil {
		log.Println("Error retrieving private key from RPC:", err)
		http.Error(w, "Failed to retrieve private key", http.StatusInternalServerError)
		return
	}

	var privateKeyWIF string
	err = json.Unmarshal(response.Result, &privateKeyWIF)
	if err != nil {
		log.Println("Error unmarshaling private key:", err)
		http.Error(w, "Failed to parse private key", http.StatusInternalServerError)
		return
	}

	// Convert private key to public key
	publicKey, err := privateKeyToPublicKey(privateKeyWIF)
	if err != nil {
		log.Println("Error converting private key to public key:", err)
		http.Error(w, "Failed to convert private key to public key", http.StatusInternalServerError)
		return
	}

	result := map[string]string{
		"address":    address,
		"privateKey": privateKeyWIF, //Store privateKeyWIF instead of privateKey
		"publicKey":  publicKey,
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		http.Error(w, "Failed to encode result as JSON", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(resultJSON)
}

/* func privateKeyWIFToPublicKey(privateKeyWIF string) (string, error) {
	wif, err := btcutil.DecodeWIF(privateKeyWIF)
	if err != nil {
		return "", err
	}

	publicKey := wif.PrivKey.PubKey()
	publicKeyBytes := publicKey.SerializeCompressed()

	return hex.EncodeToString(publicKeyBytes), nil
} */

func privateKeyToPublicKey(privateKeyWIF string) (string, error) {
	wif, err := btcutil.DecodeWIF(privateKeyWIF)
	if err != nil {
		return "", err
	}

	publicKey := wif.PrivKey.PubKey()
	publicKeyBytes := publicKey.SerializeCompressed()

	return hex.EncodeToString(publicKeyBytes), nil
}

// Add this function to your code
func decodeTransaction(transactionHex string) (*btcutil.Tx, error) {
	serializedTx, err := hex.DecodeString(transactionHex)
	if err != nil {
		return nil, err
	}

	tx, err := btcutil.NewTxFromBytes(serializedTx)
	if err != nil {
		return nil, err
	}

	return tx, nil
}

func mineBlocksHandler(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for the client-side application
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusBadRequest)
		return
	}

	var requestData map[string]string
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	_, ok := requestData["address"]
	if !ok {
		http.Error(w, "Address not provided", http.StatusBadRequest)
		return
	}

	client, err := rpcclient.New(&rpcclient.ConnConfig{
		Host:         "localhost:18332",
		User:         "bitcoin",
		Pass:         "bitcoin",
		DisableTLS:   true,
		HTTPPostMode: true,
	}, nil)
	if err != nil {
		http.Error(w, "Failed to connect to Bitcoin node", http.StatusInternalServerError)
		return
	}
	defer client.Shutdown()

	// Parse the provided address
	btcAddress, err := btcutil.DecodeAddress(requestData["address"], &chaincfg.RegressionNetParams)
	if err != nil {
		http.Error(w, "Invalid address", http.StatusBadRequest)
		return
	}

	// Mine 110 blocks to the specified address
	var transactions []btcjson.TxRawResult
	for i := 0; i < 110; i++ {
		blockHashes, err := client.GenerateToAddress(1, btcAddress, nil)
		if err != nil {
			http.Error(w, "Failed to mine block", http.StatusInternalServerError)
			return
		}

		hash := blockHashes[0]

		block, err := client.GetBlockVerboseTx(hash)
		if err != nil {
			http.Error(w, "Failed to get block", http.StatusInternalServerError)
			return
		}

		for _, tx := range block.Tx {
			txHash, err := chainhash.NewHashFromStr(tx.Txid)
			if err != nil {
				log.Printf("Error converting txid to chainhash: %v", err)
				continue
			}

			rawTx, err := client.GetTransaction(txHash)
			if err != nil {
				log.Printf("Error getting transaction: %v", err)
				continue
			}

			log.Printf("rawTx: %+v", rawTx)   // Move this inside the loop
			log.Printf("client: %+v", client) // Move this inside the loop

			if rawTx.BlockHash != "" {
				blockHash, err := chainhash.NewHashFromStr(rawTx.BlockHash)
				if err != nil {
					log.Printf("Error converting block hash: %v", err)
					continue
				}
				_, err = client.GetBlock(blockHash)
			} else {
				log.Printf("rawTx.BlockHash is empty")
			}

			txRaw := btcjson.TxRawResult{
				Hex:           tx.Hex,
				Txid:          tx.Txid,
				Hash:          tx.Hash,
				Size:          tx.Size,
				Vsize:         tx.Vsize,
				Version:       tx.Version,
				LockTime:      tx.LockTime,
				Vin:           tx.Vin,
				Vout:          tx.Vout,
				BlockHash:     tx.BlockHash,
				Confirmations: tx.Confirmations,
				Time:          tx.Time,
				Blocktime:     tx.Blocktime,
			}
			transactions = append(transactions, txRaw)
		}
	}
	// Filter the transactions
	validTransactions, err := filterValidTransactions(transactions, client)
	if err != nil {
		log.Printf("Error filtering transactions: %v", err) // Log the error for better visibility
		http.Error(w, "Failed to filter transactions", http.StatusInternalServerError)
		return
	}

	// Decode each valid transaction
	/* 	for _, tx := range validTransactions {
		decodedTx, err := decodeTransaction(tx.TxID)
		if err != nil {
			log.Printf("Error decoding transaction: %v", err)
			// Handle the error or continue to the next transaction
			continue
		}
	} */

	// Return a successful response with the filtered transactions
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":       "success",
		"transactions": validTransactions,
	})

	log.Printf("Total transactions mined: %d\n", len(transactions))

}

func proxyTransactionDetails(w http.ResponseWriter, r *http.Request) {
	txHash := r.URL.Query().Get("txHash")

	jsonData := map[string]string{
		"txid": txHash,
	}

	jsonValue, err := json.Marshal(jsonData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	resp, err := http.Post("http://203.18.30.236:8090/api/transaction-details", "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		log.Printf("Error fetching transaction details: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading transaction details response body: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Response body: %s", string(body))

	var jsonResponse map[string]interface{}
	err = json.Unmarshal(body, &jsonResponse)
	if err != nil {
		log.Printf("Error unmarshaling transaction details JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(jsonResponse)
}

/* func decodeTransaction(transactionHex string) (*btcutil.Tx, error) {
	serializedTx, err := hex.DecodeString(transactionHex)
	if err != nil {
		return nil, err
	}

	tx, err := btcutil.NewTxFromBytes(serializedTx)
	if err != nil {
		return nil, err
	}

	return tx, nila
} */

func handleTransactionDetails(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for the client-side application
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusBadRequest)
		return
	}

	var requestData map[string]string
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		http.Error(w, "Invalid request data", http.StatusBadRequest)
		return
	}

	txID, ok := requestData["txid"]
	if !ok {
		http.Error(w, "Transaction ID not provided", http.StatusBadRequest)
		return
	}

	req := RPCRequest{
		ID:      1,
		Method:  "getrawtransaction",
		Params:  []interface{}{txID, true},
		Jsonrpc: "1.0",
	}

	response, err := callRPC(req)
	if err != nil {
		log.Println("Error retrieving transaction details from RPC:", err)
		http.Error(w, "Failed to retrieve transaction details", http.StatusInternalServerError)
		return
	}

	var transactionDetails json.RawMessage
	err = json.Unmarshal(response.Result, &transactionDetails)
	if err != nil {
		log.Println("Error unmarshaling transaction details:", err)
		http.Error(w, "Failed to parse transaction details", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(transactionDetails)
}

func filterValidTransactions(transactions []btcjson.TxRawResult, client *rpcclient.Client) ([]Transaction, error) {
	var validTransactions []Transaction

	// Convert btcjson.TxRawResult to Transaction type and store in a slice
	txList := make([]Transaction, 0, len(transactions))
	for _, tx := range transactions {
		txidHash, err := chainhash.NewHashFromStr(tx.Txid)
		if err != nil {
			return nil, err
		}

		detailedTx, err := client.GetTransaction(txidHash)
		if err != nil {
			return nil, err
		}

		blockHash, err := chainhash.NewHashFromStr(detailedTx.BlockHash)
		if err != nil {
			return nil, err
		}

		block, err := client.GetBlockVerbose(blockHash)
		if err != nil {
			return nil, err
		}

		if len(detailedTx.Details) > 0 {
			vout := tx.Vout[0] // Use the first vout for the miner reward
			txList = append(txList, Transaction{
				TxID:          tx.Txid,
				Blockhash:     tx.BlockHash,
				Blockheight:   block.Height,
				N:             int(vout.N),
				Value:         vout.Value,
				Asm:           vout.ScriptPubKey.Asm,
				ScriptHex:     vout.ScriptPubKey.Hex,
				ReqSigs:       int(vout.ScriptPubKey.ReqSigs),
				Confirmations: int(tx.Confirmations),
			})
		}
	}

	// Sort transactions based on blockheight
	sort.Slice(txList, func(i, j int) bool {
		return txList[i].Blockheight < txList[j].Blockheight
	})

	// Select the first 10 transactions from the sorted list
	if len(txList) > 10 {
		validTransactions = txList[:10]
	} else {
		validTransactions = txList
	}

	return validTransactions, nil
}

func main() {
	// Set up CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://203.18.30.236:3000"},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	http.Handle("/generate-keypair", c.Handler(http.HandlerFunc(generateKeyPairHandler)))
	http.Handle("/options", c.Handler(http.HandlerFunc(optionsHandler)))
	http.Handle("/api/mine-blocks", c.Handler(http.HandlerFunc(mineBlocksHandler)))
	http.Handle("/api/transaction-details", c.Handler(http.HandlerFunc(handleTransactionDetails)))
	http.Handle("/api/proxy-transaction-details", c.Handler(http.HandlerFunc(proxyTransactionDetails)))

	port := "8090"
	log.Println("Server running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
