package main

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"fmt"
	"encoding/hex"

	"github.com/rs/cors"
	"github.com/btcsuite/btcd/btcec"
	"github.com/btcsuite/btcutil"
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

    // Convert WIF private key to hex string
    privateKey, err := wifToHex(privateKeyWIF)
    if err != nil {
        log.Println("Error converting WIF private key to hex:", err)
        http.Error(w, "Failed to convert WIF private key to hex", http.StatusInternalServerError)
        return
    }

    // Convert private key to public key
    publicKey, err := privateKeyToPublicKey(privateKey)
    if err != nil {
        log.Println("Error converting private key to public key:", err)
        http.Error(w, "Failed to convert private key to public key", http.StatusInternalServerError)
        return
    }

    result := map[string]string{
        "address":    address,
        "privateKey": privateKey,
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


func privateKeyToPublicKey(privateKey string) (string, error) {
    privKeyBytes, err := hex.DecodeString(privateKey)
    if err != nil {
        return "", err
    }

    privKey, _ := btcec.PrivKeyFromBytes(btcec.S256(), privKeyBytes)
    publicKey := privKey.PubKey()
    publicKeyBytes := publicKey.SerializeCompressed()

    return hex.EncodeToString(publicKeyBytes), nil
}


func wifToHex(privateKeyWIF string) (string, error) {
	wif, err := btcutil.DecodeWIF(privateKeyWIF)
	if err != nil {
		return "", err
	}
	privateKeyBytes := wif.PrivKey.Serialize()
	return hex.EncodeToString(privateKeyBytes), nil
}


func main() {
	// Set up CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://203.18.30.236:3000"},
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Wrap your handlers with CORS middleware
	http.Handle("/generate-keypair", c.Handler(http.HandlerFunc(generateKeyPairHandler)))
	http.Handle("/options", c.Handler(http.HandlerFunc(optionsHandler)))

	port := "8080"
	log.Println("Server running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
