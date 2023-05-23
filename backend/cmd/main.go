package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"sort"
	"strings"

	"github.com/btcsuite/btcd/btcjson"
	"github.com/btcsuite/btcd/chaincfg"
	"github.com/btcsuite/btcd/chaincfg/chainhash"
	"github.com/btcsuite/btcd/rpcclient"
	"github.com/btcsuite/btcutil"
	"github.com/rs/cors"
)

type SignRequest struct {
	UnsignedSighashes []string `json:"unsignedSighashes"`
	PrivateKeys       []string `json:"privateKeys"`
}

type SignResponse struct {
	Signatures []string `json:"signatures"`
}

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
	Index         int     `json:"index"`
	TxID          string  `json:"txid"`
	Blockhash     string  `json:"blockhash"`
	Blockheight   int64   `json:"blockheight"`
	N             int     `json:"n"`
	Value         float64 `json:"value"`
	Asm           string  `json:"asm"`
	ScriptHex     string  `json:"scripthex"`
	ReqSigs       int     `json:"reqsigs"`
	Confirmations int     `json:"confirmations"`
}

type ErrorResponse struct {
	Message string `json:"message"`
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
		blockhashes, err := client.GenerateToAddress(1, btcAddress, nil)
		if err != nil {
			http.Error(w, "Failed to mine block", http.StatusInternalServerError)
			return
		}

		hash := blockhashes[0]

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
				blockhash, err := chainhash.NewHashFromStr(rawTx.BlockHash)
				if err != nil {
					log.Printf("Error converting block hash: %v", err)
					continue
				}
				_, err = client.GetBlock(blockhash)
			} else {
				log.Printf("rawTx.Blockhash is empty")
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

		blockhash, err := chainhash.NewHashFromStr(detailedTx.BlockHash)
		if err != nil {
			return nil, err
		}

		block, err := client.GetBlockVerbose(blockhash)
		if err != nil {
			return nil, err
		}

		if len(detailedTx.Details) > 0 {
			vout := tx.Vout[0] // Use the first vout for the miner reward
			txList = append(txList, Transaction{
				Index:         len(validTransactions),
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

func doubleSha256(hexData string) string {
	// Convert the hex string to a byte array
	rawData, err := hex.DecodeString(hexData)
	if err != nil {
		log.Fatal(err)
	}

	// Perform the first hash
	hasher := sha256.New()
	hasher.Write(rawData)
	firstHash := hasher.Sum(nil)

	// Perform the second hash
	hasher.Reset()
	hasher.Write(firstHash)
	secondHash := hasher.Sum(nil)

	return hex.EncodeToString(secondHash)
}

func doubleSha256Handler(w http.ResponseWriter, r *http.Request) {
	var requestData struct {
		Data string `json:"data"`
	}
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	doubleHash := doubleSha256(requestData.Data)

	response := struct {
		Hash string `json:"hash"`
	}{
		Hash: doubleHash,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func signSighashesHandler(w http.ResponseWriter, r *http.Request) {
	// Parse the request body
	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Decode the JSON request
	var signReq SignRequest
	err = json.Unmarshal(body, &signReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Sign the SIGHASHes with the provided private keys
	signatures, err := signSighashes(signReq.UnsignedSighashes, signReq.PrivateKeys)
	if err != nil {
		log.Println(err) // Add this line
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Create the response object
	signResp := SignResponse{
		Signatures: signatures,
	}

	// Encode the response as JSON
	respBytes, err := json.Marshal(signResp)
	if err != nil {
		log.Println(err) // Add this line
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set the response header and write the response
	w.Header().Set("Content-Type", "application/json")
	w.Write(respBytes)
}

func signSighashes(unsignedSighashes, privateKeys []string) ([]string, error) {
	signatures := make([]string, len(unsignedSighashes))

	// Iterate through the unsignedSighashes and privateKeys arrays
	for i := 0; i < len(unsignedSighashes); i++ {
		// Decode the private key from its WIF representation
		wif, err := btcutil.DecodeWIF(privateKeys[i])
		if err != nil {
			return nil, fmt.Errorf("error decoding WIF for private key %d: %v", i, err)
		}

		// Ensure the decoded private key is for the correct network (mainnet, testnet3, etc.)
		if !wif.IsForNet(&chaincfg.RegressionNetParams) {
			return nil, fmt.Errorf("private key %d is not for the regtest network", i)
		}

		// Parse the SIGHASH from its hex representation
		sighashBytes, err := hex.DecodeString(unsignedSighashes[i])
		if err != nil {
			return nil, fmt.Errorf("error decoding SIGHASH %d: %v", i, err)
		}

		// Sign the SIGHASH using the private key
		signature, err := wif.PrivKey.Sign(sighashBytes)
		if err != nil {
			return nil, fmt.Errorf("error signing SIGHASH %d: %v", i, err)
		}

		// Convert the signature to DER format and encode it as a hex string
		signatureDER := signature.Serialize()
		signatureHex := hex.EncodeToString(signatureDER)

		signatures[i] = signatureHex
	}

	return signatures, nil
}

func broadcastTransactionHandler(w http.ResponseWriter, r *http.Request) {
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

	txHex, ok := requestData["transaction"]
	if !ok {
		http.Error(w, "Transaction not provided", http.StatusBadRequest)
		return
	}

	txHex = strings.TrimSpace(txHex)

	/* // Decode the transaction
	tx, err := decodeTransaction(txHex)
	if err != nil {
		http.Error(w, "Invalid transaction", http.StatusBadRequest)
		return
	} */

	// Call RPC
	req := RPCRequest{
		ID:      1,
		Method:  "sendrawtransaction",
		Params:  []interface{}{txHex},
		Jsonrpc: "1.0",
	}

	// Here is the missing function call:
	response, err := callRPC(req)

	// Then in your error handling:
	if err != nil {
		log.Println("Error sending transaction via RPC:", err)
		errorResponse := ErrorResponse{Message: "Failed to send transaction"}
		errorJSON, _ := json.Marshal(errorResponse)
		http.Error(w, string(errorJSON), http.StatusInternalServerError)
		return
	}

	// Check the response
	var txid string
	err = json.Unmarshal(response.Result, &txid)
	if err != nil {
		log.Println("Error unmarshaling transaction id:", err)
		http.Error(w, "Failed to parse transaction id", http.StatusInternalServerError)
		return
	}

	result := map[string]string{
		"txid": txid,
	}

	resultJSON, err := json.Marshal(result)
	if err != nil {
		http.Error(w, "Failed to encode result as JSON", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(resultJSON)
}

func getTransactionHandler(w http.ResponseWriter, r *http.Request) {
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

	txid, ok := requestData["txid"]
	if !ok {
		http.Error(w, "Transaction id not provided", http.StatusBadRequest)
		return
	}

	// Call RPC
	req := RPCRequest{
		ID:      1,
		Method:  "gettransaction",
		Params:  []interface{}{txid},
		Jsonrpc: "1.0",
	}

	response, err := callRPC(req)
	if err != nil {
		log.Println("Error retrieving transaction via RPC:", err)
		http.Error(w, "Failed to retrieve transaction", http.StatusInternalServerError)
		return
	}

	resultJSON, err := json.Marshal(response.Result)
	if err != nil {
		http.Error(w, "Failed to encode result as JSON", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(resultJSON)
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
	http.Handle("/api/double-sha256", c.Handler(http.HandlerFunc(doubleSha256Handler)))
	http.Handle("/api/sign-sighashes", c.Handler(http.HandlerFunc(signSighashesHandler)))
	http.Handle("/api/broadcast-transaction", c.Handler(http.HandlerFunc(broadcastTransactionHandler)))
	http.Handle("/api/get-transaction", c.Handler(http.HandlerFunc(getTransactionHandler)))

	port := "8090"
	log.Println("Server running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
