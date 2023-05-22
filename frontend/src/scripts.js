function setTooltipAttributes() {
  const tooltipItems = document.querySelectorAll("#sighashMenu .list-group-item");
  const templateKeys = [
    "all",
    "none",
    "single",
    "all-anyonecanpay",
    "none-anyonecanpay",
    "single-anyonecanpay",
  ];

  tooltipItems.forEach((item, index) => {
    const tooltipJSON = commonKeys.reduce((acc, key) => {
      const row = sighashTemplates[templateKeys[index]].find((row) => row.key === key);
      const value = row ? row.value : "-";
      acc[key] = value === "" ? "32-byte zero hash" : value;
      return acc;
    }, {});

    item.setAttribute("data-bs-toggle", "tooltip");
    item.setAttribute("data-bs-html", "true");
    item.setAttribute("data-bs-original-title", `<pre>${JSON.stringify(tooltipJSON, null, 2)}</pre>`);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  // Call the setTooltipAttributes function
  setTooltipAttributes();
  attachPreimageEventListeners();

  // Initialize the tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  document.getElementById("processTransactionDataButton").addEventListener("click", () => {
    console.log('Process Transaction Data button clicked');
    const inputCount = parseInt(document.querySelector("#inputCount").value);
    const transaction = createTransactionFromForm();
    
    // Display the standard JSON
    displayTransactionJSON(transaction);

    // Display the editable transaction JSON form
    displayEditableTransactionJSON(transaction);

    generatePreimageTemplates(inputCount);
    generateUnlockScriptTemplates(inputCount);

    // Call attachPreimageEventListeners after generating the preimage templates
    attachPreimageEventListeners();
});

  
  document.getElementById('generateSighashButton').addEventListener('click', async () => {
    // Call the displayPreimages function
    displayPreimages();
  
    // Extract the preimages and calculate the sighashes
    const preimages = [];
    const preimageInputs = document.querySelectorAll(".preimage");
    preimageInputs.forEach((input) => {
      preimages.push(input.value);
    });
  
    const sighashes = [];
  
    for (const preimage of preimages) {
      const hash = await callBackendHashing(preimage);
      sighashes.push(hash);
    }
  
    displaySighashes(sighashes);
    displayUnsignedSighashes(sighashes);
  });
  

  document.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  });
  

  document.addEventListener("paste", function(event) {
    var clipboardData = event.clipboardData.getData("text/plain");
    if (clipboardData.indexOf(" ") !== -1) {
      clipboardData = clipboardData.replace(/\s/g, "");
      event.clipboardData.setData("text/plain", clipboardData);
    }
  });
  
  

  document.getElementById("inputCount").addEventListener("change", (event) => {
    createInputContainers(event);
  });

  document.getElementById("outputCount").addEventListener("change", (event) => {
    createOutputContainers(event);
  });

  document.getElementById('generatekeypair').addEventListener('click', generateKeyPair);
  document.getElementById('mineBlocks').addEventListener('click', mineBlocks);
/*   document.getElementById('generateTXID').addEventListener('click', generateTXID);
  document.getElementById('broadcastTX').addEventListener('click', broadcastTX);
 */
  /* document.getElementById('inputCount').addEventListener('input', createInputContainers);
  document.getElementById('outputCount').addEventListener('input', createOutputContainers); */
});

window.addEventListener("load", () => {
  document.getElementById("inputContainers").innerHTML = "";
  document.getElementById("outputContainers").innerHTML = "";
  // Call logTooltipJSON() to log the JSON for each tooltip in the console
  logTooltipJSON();
  });
  
  document.getElementById('signSighash').addEventListener('click', async () => {
    const unsignedSighashes = getSighashesFromTable(); // Assuming you have this function
    const privateKeys = getPrivateKeysFromTable(); // You need to implement this
  
    const response = await fetch('http://203.18.30.236:8090/api/sign-sighashes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        unsignedSighashes: unsignedSighashes,
        privateKeys: privateKeys,
      }),
    });
  
    if (response.ok) {
      const responseData = await response.json();
      const signatures = responseData.signatures;
      displaySignatures(signatures);
    } else {
      console.error('Error signing SIGHASHes:', response.statusText);
    }
  });
  
  

async function generateKeyPair(event) {
  event.preventDefault();

  try {
    const response = await fetch("http://203.18.30.236:8090/generate-keypair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const publicKey = result.publicKey;

    const keyPairTableBody = document.getElementById("keypairTableBody");
    const row = document.createElement("tr");

    const indexCell = document.createElement("td");
    const publicKeyCell = document.createElement("td");
    const privateKeyCell = document.createElement("td");
    const addressCell = document.createElement("td");

    // Define the index variable
    const index = keyPairTableBody.children.length + 1;

    indexCell.innerText = index;
    publicKeyCell.innerText = publicKey;
    privateKeyCell.innerText = result.privateKey;
    addressCell.innerText = result.address;

    row.appendChild(indexCell);
    row.appendChild(publicKeyCell);
    row.appendChild(privateKeyCell);
    row.appendChild(addressCell);

    keyPairTableBody.appendChild(row);

    // Add options to the drop-down menu when new key pairs are generated
    const keyPairSelector = document.querySelector('#keyPairSelector');
    const newOption = document.createElement('option');
    newOption.value = index;
    newOption.innerText = `Index ${index}`;
    keyPairSelector.appendChild(newOption);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function mineBlocks() {
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const selectedIndex = keyPairSelector.value;

  // Get the address from the table
  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const addressCell = selectedRow.children[3];
  const selectedAddress = addressCell.innerText;

  console.log(`Mining 110 blocks to address with index: ${selectedIndex}`);

  try {
    const response = await fetch(`http://203.18.30.236:8090/api/mine-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: selectedAddress }),
    });

    if (!response.ok) {
      throw new Error('Error mining blocks');
    }

    const minedData = await response.json();
    console.log('Mined data:', minedData);
    displaySpendableTransactionOutputs(minedData.transactions);
  } catch (error) { // Add this catch block
    console.error('Error:', error);
  }

}

// Add this helper function to fetch transaction details from the Woc explorer API
async function fetchTransactionDetails(txHash) {
  const response = await fetch(`http://203.18.30.236:8090/api/proxy-transaction-details?txHash=${txHash}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const txDetails = await response.json();
  return txDetails;
}

function createSpendableTransactionOutput(index, txDetails, output, selectedPrivateKey) {
  const lockScriptSize = output.scriptPubKey.hex.length / 2;
  const unlockScriptSize = output.scriptPubKey.hex.length / 2;

  return {
    index: index,
    blockHeight: txDetails.blockheight,
    blockHash: txDetails.blockhash,
    vout: output.n,
    txid: txDetails.txid,
    value: output.value,
    lockScriptSize: lockScriptSize,
    lockScriptAsm: output.scriptPubKey.asm,
    lockScriptHex: output.scriptPubKey.hex,
    reqSigs: output.scriptPubKey.reqSigs,
    confirmations: txDetails.confirmations,
    privateKey: selectedPrivateKey,
    unlockScriptSize: unlockScriptSize,
    unlockScript: output.scriptPubKey.hex,
    sequence: 0xffffffff,
    sighashFlag: '01',
  };
}

async function fetchSTODetails(sto) {
  return {
    txid: sto.txid,
    vout: sto.vout,
    value: sto.value,
    unlockScript: sto.unlockScript,
    sequence: sto.sequence,
    sighashFlag: sto.sighashFlag,
  };
}

async function displaySpendableTransactionOutputs(transactions) {
  const stoContainer = document.querySelector("#stoContainer");
  const keyPairSelector = document.querySelector("#keyPairSelector");
  const selectedIndex = keyPairSelector.value;

  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const privateKeyCell = selectedRow.children[2];
  const selectedPrivateKey = privateKeyCell.innerText;

  stoContainer.innerHTML = ""; // clear the container before populating new data

  const spendableTransactionOutputs = [];

  const transactionPromises = transactions.map(async (transaction, index) => {
    const txDetails = await fetchTransactionDetails(transaction.txid);
    const output = txDetails.vout[0];
    const sto = createSpendableTransactionOutput(index + 1, txDetails, output, selectedPrivateKey);
    spendableTransactionOutputs.push(sto);
  });

  await Promise.all(transactionPromises);

  // Sort spendable transaction outputs by block height
  spendableTransactionOutputs.sort((a, b) => a.blockHeight - b.blockHeight);

  // Display spendable transaction outputs
  spendableTransactionOutputs.forEach((spendableTransactionOutput, index) => {
    const stoElement = document.createElement("pre");
    stoElement.id = `sto-json-${index + 1}`;
    stoElement.className = "sto-json";
    stoElement.style.display = index === 0 ? "block" : "none";
    stoElement.innerText = JSON.stringify(spendableTransactionOutput, null, 2);
    stoContainer.appendChild(stoElement);
  });

  // Create pagination navigation
  const paginationNav = document.createElement("div");
  paginationNav.className = "pagination-nav";

  spendableTransactionOutputs.forEach((_, index) => {
    const navLink = document.createElement("a");
    navLink.href = "#";
    navLink.innerText = index + 1;
    navLink.addEventListener("click", (e) => {
      e.preventDefault();
      showStoElement(index);
    });

    paginationNav.appendChild(navLink);
  });

  stoContainer.appendChild(paginationNav);

  // Return the spendable transaction outputs
  return spendableTransactionOutputs;
}

function showStoElement(index) {
  const stoElements = document.querySelectorAll(".sto-json");

  stoElements.forEach((element, i) => {
    element.style.display = i === index ? "block" : "none";
  });
}

function getTransactionVersionValue() {
  return getElementValueById('version');
}

function getElementValueById(id, index) {
  let element;
  if (index === undefined) {
    element = document.getElementById(id) || document.getElementById(capitalizeFirstLetter(id));
  } else {
    element = document.querySelector(`input[id^="${id}-${index}"], input[id^="${capitalizeFirstLetter(id)}-${index}"]`);
  }
  return element ? element.value : null;
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function createTransactionFromForm() {
  const transactionLockTime = document.querySelector("#nLockTime").value.padStart(8, "0");

  const inputs = getInputs().map(input => ({
    TXID: input.prevoutHash,
    VOUT: input.prevoutN.padStart(8, "0"),
    unlockScriptSize: input.unlockScript.length / 2,
    unlockScript: input.unlockScript,
    nSequence: input.sequence.padStart(8, "0"),
    sighashFlag: input.sighashFlag,
  }));

  const outputs = getOutputs().map(output => ({
    value: output.value,
    lockScriptSize: output.lockScriptSize,
    lockScript: output.lockScript,
  }));

  const transaction = {
    version: getTransactionVersionValue().padStart(8, "0"),
    inputCount: toVarInt(inputs.length),
    inputs: inputs,
    outputCount: toVarInt(outputs.length),
    outputs: outputs,
    nLockTime: transactionLockTime,
  };

  return transaction;
}


// Helper function to reverse the byte order
function reverseEndian(hexString) {
  return hexString.match(/.{2}/g).reverse().join("");
}

// Convert bitcoins to satoshis
document.getElementById("btcToSatoshisButton").addEventListener("click", function () {
  const btc = parseFloat(document.getElementById("btcToSatoshis").value);
  const satoshis = Math.round(btc * 100000000);
  document.getElementById("btcToSatoshisResult").textContent = satoshis;
});

// Convert decimal to hexadecimal
document.getElementById("decimalToHexButton").addEventListener("click", function () {
  const decimal = parseInt(document.getElementById("decimalToHex").value);
  const hex = decimal.toString(16);
  document.getElementById("decimalToHexResult").textContent = hex;
});

// Switch endianness
document.getElementById("switchEndianButton").addEventListener("click", function () {
  const hex = document.getElementById("switchEndian").value;
  const switchedEndian = reverseEndian(hex);
  document.getElementById("switchEndianResult").textContent = switchedEndian;
});


function getInputs() {
  const inputCount = parseInt(document.getElementById("inputCount").value, 16);
  const inputs = [];

  for (let i = 0; i < inputCount; i++) {
    const prevoutHash = document.getElementById(`inputTXID-${i}`).value;
    const prevoutN = document.getElementById(`inputVOUT-${i}`).value;
    const unlockScriptSize = document.getElementById(`inputUnlockScriptSize-${i}`).value;
    const unlockScript = document.getElementById(`inputUnlockScript-${i}`).value;
    const sequence = document.getElementById(`inputSequence-${i}`).value;
    const sighashFlag = document.getElementById(`sighashFlag-${i}`).value;

    inputs.push({ prevoutHash, prevoutN, unlockScriptSize, unlockScript, sequence, sighashFlag });
  }

  return inputs;
}



function getOutputs() {
  const outputCount = parseInt(document.getElementById("outputCount").value, 16);
  const outputs = [];

  for (let i = 0; i < outputCount; i++) {
    const value = document.getElementById(`outputValue-${i}`).value;
    const lockScriptSize = document.getElementById(`outputLockScriptSize-${i}`).value;
    const lockScript = document.getElementById(`outputLockScript-${i}`).value;

    outputs.push({ value, lockScriptSize, lockScript });
  }

  return outputs;
}



function createInputContainers(event) {
  updateInputOrOutputContainers("input", event);
}

function createOutputContainers(event) {
  updateInputOrOutputContainers("output", event);
}

document.getElementById("inputCount").addEventListener("change", (event) => {
  createInputContainers(event);
});

document.getElementById("outputCount").addEventListener("change", (event) => {
  createOutputContainers(event);
});

function updateInputOrOutputContainers(containerType) {
  const countField = document.querySelector(`#${containerType}Count`);
  const countHex = countField.value;
  const count = parseInt(parseVarInt(countHex, 0).value, 16);
  const maxCount = 5;

  console.log(`${containerType} count:`, count);

  if (count <= maxCount) {
    const containers = document.getElementById(`${containerType}Containers`);

    // Clear the containers div before adding new ones
    containers.innerHTML = "";

    const containerTemplate = document.getElementById(`${containerType}ContainerTemplate`);

    for (let i = 0; i < count; i++) {
      const newContainer = containerTemplate.content.cloneNode(true);
      newContainer.querySelector(`.${containerType}Index`).textContent = i + 1;

      // Add collapsible behavior
      const collapseButton = newContainer.querySelector(`button[data-bs-toggle="collapse"]`);
      collapseButton.setAttribute("data-bs-target", `#${containerType}Content-${i}`);

      const collapseContent = newContainer.querySelector(".collapse");
      collapseContent.id = `${containerType}Content-${i}`;

      // Set unique ids for the fields
      newContainer.querySelectorAll("input, select").forEach((element) => {
        const name = element.getAttribute("name");
        element.id = `${name}-${i}`;
        console.log(`Created element id: ${element.id}`);  // Add this line

      });

      // Append the new container as a child of the parent div
      containers.appendChild(newContainer);
    }
  }
}

function displayTransactionJSON(transaction) {
  const transactionJSONContainer = document.getElementById("transactionJSONContainer");

  // Remove the existing transaction JSON data if it exists
  const existingTransactionData = transactionJSONContainer.querySelector("pre");
  if (existingTransactionData) {
    transactionJSONContainer.removeChild(existingTransactionData);
  }

  // Create a pre element to display the transaction JSON data
  const transactionJSONData = document.createElement("pre");
  transactionJSONData.innerText = JSON.stringify(transaction, null, 2);

  // Append the pre element to the transaction JSON container
  transactionJSONContainer.appendChild(transactionJSONData);
}

function showPreimageElement(index) {
  const preimageElements = document.querySelectorAll(".preimage-json");

  preimageElements.forEach((element, i) => {
    element.style.display = i === index ? "block" : "none";
  });
}
 
async function processTransactionData() {
  const version = document.getElementById("version").value;
  const inputCount = document.getElementById("inputCount").value;
  const inputs = getInputs();
  const outputCount = document.getElementById("outputCount").value;
  const outputs = getOutputs();
  const nLockTime = document.getElementById("nLockTime").value;

  const payload = {
    version,
    inputCount,
    inputs,
    outputCount,
    outputs,
    nLockTime,
  };

  console.log("Transaction Payload:", JSON.stringify(payload, null, 2));

  // Display the transaction JSON payload in the browser
  displayTransactionJSON(payload);

  // Call the backend service to process the transaction data

}


window.addEventListener("load", () => {
  document.getElementById("inputContainers").innerHTML = "";
  document.getElementById("outputContainers").innerHTML = "";
  // Call logTooltipJSON() to log the JSON for each tooltip in the console
  logTooltipJSON();

  // Add the event listener for the "Process Transaction Data" button
  document.getElementById("processTransactionDataButton").addEventListener("click", processTransactionData);
});


const baseTemplate = [
  { key: "nVersion", value: "4-byte little-endian" },
  { key: "hashPrevouts", value: "32-byte SHA256d of all concatenated inputs' TXIDs and vouts, both in little-endian format" },
  { key: "hashSequence", value: "32-byte SHA256d of all concatenated inputs' nSequence values, little-endian format" },
  { key: "outpoint", value: "32-byte input txid in little-endian + 4-byte vout in little-endian" },
  { key: "lockScript", value: "CompactSize varInt for lockScript size + lockScript of the output being spent" },
  { key: "value", value: "8-byte satoshis, little-endian format" },
  { key: "nSequence", value: "4-byte little-endian of the input being signed" },
  { key: "hashOutputs", value: "32-byte SHA256d of all concatenated outputs' values, CompactSize varInt for lockScript size, and lockScripts, values in little-endian format" },
  { key: "nLockTime", value: "4-byte little-endian" },
  { key: "nHashType", value: "4-byte little-endian" },
];

const zeroHashField = { key: "32-byte zero hash", value: "" };

const sighashTemplates = {
  all: baseTemplate,
  none: [
    ...baseTemplate.slice(0, 2),
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    zeroHashField,
    ...baseTemplate.slice(7),
  ],
  single: [
    ...baseTemplate.slice(0, 2),
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    { key: "hashOutputs", value: "SHA256d of the single output corresponding to the input being signed, value in little-endian format" },
    ...baseTemplate.slice(7),
  ],
  "all-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    ...baseTemplate.slice(2),
  ],
  "none-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    zeroHashField,
    ...baseTemplate.slice(7),
  ],
  "single-anyonecanpay": [
    ...baseTemplate.slice(0, 1),
    zeroHashField,
    zeroHashField,
    ...baseTemplate.slice(3, 6),
    { key: "hashOutputs", value: "SHA256d of the single output corresponding to the input being signed, value in little-endian format" },
    ...baseTemplate.slice(7),
  ],
};


const commonKeys = [
  "nVersion",
  "hashPrevouts",
  "hashSequence",
  "outpoint",
  "lockScript",
  "value",
  "nSequence",
  "hashOutputs",
  "nLockTime",
  "nHashType",
];


function logTooltipJSON() {
  const templateKeys = [
    "all",
    "none",
    "single",
    "all-anyonecanpay",
    "none-anyonecanpay",
    "single-anyonecanpay",
  ];

  templateKeys.forEach((templateKey) => {
    const tooltipJSON = commonKeys.reduce((acc, key) => {
      const row = sighashTemplates[templateKey].find((row) => row.key === key);
      const value = row ? row.value : "-";
      acc[key] = value === "" ? "32-byte zero hash" : value;
      return acc;
    }, {});

    console.log(`${templateKey}:\n${JSON.stringify(tooltipJSON, null, 2)}\n`);
  });
}

function parseVarInt(hex, start) {
  const firstByte = parseInt(hex.substr(start * 2, 2), 16);
  let value;
  let size;

  if (firstByte < 0xfd) {
    value = hex.substr(start * 2, 2);
    size = 1;
  } else if (firstByte === 0xfd) {
    value = hex.substr((start + 1) * 2, 4);
    size = 3;
  } else if (firstByte === 0xfe) {
    value = hex.substr((start + 1) * 2, 8);
    size = 5;
  } else {
    value = hex.substr((start + 1) * 2, 16);
    size = 9;
  }

  return { value, size };
}

function toVarInt(value) {
  if (value < 0xfd) {
    return value.toString(16).padStart(2, "0");
  } else if (value <= 0xffff) {
    return "fd" + value.toString(16).padStart(4, "0");
  } else if (value <= 0xffffffff) {
    return "fe" + value.toString(16).padStart(8, "0");
  } else {
    return "ff" + value.toString(16).padStart(16, "0");
  }
}

function intToHexString(value, byteSize) {
  return value.toString(16).padStart(byteSize * 2, "0");
}


async function callBackendHashing(data) {
  const response = await fetch('http://203.18.30.236:8090/api/double-sha256', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const result = await response.json();
  return result.hash;
}

async function hashPrevouts(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.txid + input.vout;
  }
  return await callBackendHashing(buffer);
}

async function hashSequence(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.sequence;
  }
  return await callBackendHashing(buffer);
}

async function hashOutputs(outputs) {
  let buffer = "";
  for (const output of outputs) {
    buffer += output.value + output.lockScriptSize + output.lockScript;
  }
  return await callBackendHashing(buffer);
}

async function hashSingleOutput(output) {
  const buffer = output.value + output.lockScriptSize + output.lockScript;
  return await callBackendHashing(buffer);
}


function generatePreimageTemplates(inputCount) {
  const preimagesContainer = document.getElementById("preimagesContainer");
  const preimageFormTemplate = document.getElementById("preimageFormTemplate");

  // Remove any existing preimage forms
  const existingPreimageWrappers = preimagesContainer.querySelectorAll(".preimageWrapper");
  existingPreimageWrappers.forEach((element) => {
    preimagesContainer.removeChild(element);
  });

  // Generate the new preimage forms
  for (let i = 0; i < inputCount; i++) {
    const preimageWrapper = preimageFormTemplate.content.cloneNode(true);

    preimageWrapper.querySelector(".preimageIndex").innerText = i + 1;
    preimageWrapper.querySelector(".preimageToggle").dataset.bsTarget = `#preimageContent-${i}`;
    preimageWrapper.querySelector(".preimageContent").id = `preimageContent-${i}`;

    preimagesContainer.appendChild(preimageWrapper);
  }

  // Call attachPreimageEventListeners after creating the new preimage forms
  attachPreimageEventListeners();
}

function attachPreimageEventListeners() {
  const preimageForms = document.querySelectorAll(".preimageForm");

  preimageForms.forEach((preimageForm, i) => {
    const hashButtons = preimageForm.querySelectorAll(".hashButton");
    hashButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        let previousField, nextField;
        if (button.classList.contains("hashPrevoutsButton")) {
          previousField = button.parentElement.querySelector(".Prevouts");
          nextField = button.parentElement.querySelector(".hashPrevouts");
        } else if (button.classList.contains("hashSequenceButton")) {
          previousField = button.parentElement.querySelector(".Sequence");
          nextField = button.parentElement.querySelector(".hashSequence");
        } else if (button.classList.contains("hashOutputsButton")) {
          previousField = button.parentElement.querySelector(".Outputs");
          nextField = button.parentElement.querySelector(".hashOutputs");
        }
        const hashedValue = await callBackendHashing(previousField.value);
        nextField.value = hashedValue;
      });
    });
    const generatePreimageButton = preimageForm.querySelector(".generatePreimageButton");
    generatePreimageButton.addEventListener("click", () => {
      const preimageWrapper = generatePreimageButton.closest(".preimageWrapper");
      generatePreimage(preimageWrapper);

      /* const fields = [
        { name: "nVersion", class: "text-nversion" },
        { name: "hashPrevouts", class: "text-hashprevouts" },
        { name: "hashSequence", class: "text-hashsequence" },
        { name: "outpoint", class: "text-outpoint" },
        { name: "scriptCode", class: "text-scriptcode" },
        { name: "value", class: "text-value" },
        { name: "nSequence", class: "text-nsequence" },
        { name: "hashOutputs", class: "text-hashoutputs" },
        { name: "nLockTime", class: "text-nlocktime" },
        { name: "nHashType", class: "text-nhashtype" },
      ]; */
    });
  });
}

function generatePreimage(preimageWrapper) {
  const fields = [
    { name: "nVersion", class: "text-nversion" },
    { name: "hashPrevouts", class: "text-hashprevouts" },
    { name: "hashSequence", class: "text-hashsequence" },
    { name: "outpoint", class: "text-outpoint" },
    { name: "scriptCode", class: "text-scriptcode" },
    { name: "value", class: "text-value" },
    { name: "nSequence", class: "text-nsequence" },
    { name: "hashOutputs", class: "text-hashoutputs" },
    { name: "nLockTime", class: "text-nlocktime" },
    { name: "nHashType", class: "text-nhashtype" },
  ];

  const preimageObj = {};
  fields.forEach(({ name }) => {
    preimageObj[name] = preimageWrapper.querySelector(`.${name}`).value;
  });

  const preimage = fields.map(({ name }) => preimageObj[name]).join("");
  preimageWrapper.querySelector(".preimage").value = preimage;

  // Call the displayPreimages function to update the preimage table and JSON representations
  displayPreimages();
}

async function displayPreimages() {
  const preimageForms = document.querySelectorAll(".preimageForm");
  const preimageTableBody = document.getElementById("preimageTableBody");
  const preimageJSONContainer = document.getElementById("preimageJSONContainer");

  // Clear the contents of the preimageTableBody and preimageJSONContainer
  preimageTableBody.innerHTML = "";
  preimageJSONContainer.innerHTML = "";


  for (let i = 0; i < preimageForms.length; i++) {
    const preimageForm = preimageForms[i];

    const fields = [
      { name: "nVersion", class: "text-nversion" },
      { name: "hashPrevouts", class: "text-hashprevouts" },
      { name: "hashSequence", class: "text-hashsequence" },
      { name: "outpoint", class: "text-outpoint" },
      { name: "scriptCode", class: "text-scriptcode" },
      { name: "value", class: "text-value" },
      { name: "nSequence", class: "text-nsequence" },
      { name: "hashOutputs", class: "text-hashoutputs" },
      { name: "nLockTime", class: "text-nlocktime" },
      { name: "nHashType", class: "text-nhashtype" },
    ];

    const preimageWrapper = preimageForm.closest(".preimageWrapper");
    const preimageObj = {};
    fields.forEach(({ name }) => {
      preimageObj[name] = preimageWrapper.querySelector(`.${name}`).value;
    });

    const preimage = fields.map(({ name }) => preimageObj[name]).join("");
    preimageWrapper.querySelector(".preimage").value = preimage;

    const newRow = document.createElement("tr");
    const colorCodedPreimage = fields
      .map(({ name, class: className }) => `<span class="${className}">${preimageObj[name]}</span>`)
      .join("");

    newRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${colorCodedPreimage}</td>
    `;
    preimageTableBody.appendChild(newRow);

    const preimageJSON = createSighashPreimageJSON(i, preimageObj.nVersion, preimageObj.hashPrevouts, preimageObj.hashSequence, preimageObj.outpoint, preimageObj.scriptCode, preimageObj.value, preimageObj.nSequence, preimageObj.hashOutputs, preimageObj.nLockTime, preimageObj.nHashType);
    preimageJSONContainer.appendChild(preimageJSON);
  }

   // Call the generatePagination function
   generatePagination(preimageForms.length);

   // Hide all preimage JSONs except the first one
   const preimageJSONs = document.querySelectorAll(".preimageJSON:not(:first-child)");
   preimageJSONs.forEach((element) => {
     element.style.display = "none";
   });
  }



function createSighashPreimageJSON(inputIndex, nVersion, hashPrevouts, hashSequence, outpoint, scriptCode, value, nSequence, hashOutputs, nLockTime, nHashType) {
  const container = document.createElement("div");
  container.classList.add("sighashPreimageJSON", "mb-3", "preimageJSON");

  const preimageObj = {
    nVersion,
    hashPrevouts,
    hashSequence,
    outpoint,
    scriptCode,
    value,
    nSequence,
    hashOutputs,
    nLockTime,
    nHashType,
  };

  const preimageJSON = JSON.stringify(preimageObj, null, 2)
    .replace(/"nVersion":\s"(.*?)"/g, '<span class="jsonValue text-success">"nVersion": "$1"</span>')
    .replace(/"hashPrevouts":\s"(.*?)"/g, '<span class="jsonValue text-primary">"hashPrevouts": "$1"</span>')
    .replace(/"hashSequence":\s"(.*?)"/g, '<span class="jsonValue text-info">"hashSequence": "$1"</span>')
    .replace(/"outpoint":\s"(.*?)"/g, '<span class="jsonValue text-warning">"outpoint": "$1"</span>')
    .replace(/"scriptCode":\s"(.*?)"/g, '<span class="jsonValue text-danger">"scriptCode": "$1"</span>')
    .replace(/"value":\s"(.*?)"/g, '<span class="jsonValue text-secondary">"value": "$1"</span>')
    .replace(/"nSequence":\s"(.*?)"/g, '<span class="jsonValue text-success">"nSequence": "$1"</span>')
    .replace(/"hashOutputs":\s"(.*?)"/g, '<span class="jsonValue text-primary">"hashOutputs": "$1"</span>')
    .replace(/"nLockTime":\s"(.*?)"/g, '<span class="jsonValue text-info">"nLockTime": "$1"</span>')
    .replace(/"nHashType":\s"(.*?)"/g, '<span class="jsonValue text-warning">"nHashType": "$1"</span>');

  container.innerHTML = `
    <h5>Input #${inputIndex + 1} Preimage JSON:</h5>
    <pre>${preimageJSON}</pre>
  `;

  container.style.display = inputIndex === 0 ? "block" : "none";
  container.id = `preimageJSON-${inputIndex}`;

  return container;
}

function generatePagination(numPages) {
  const paginationElement = document.getElementById("preimageJSONPagination");

  // Clear existing pagination items
  paginationElement.innerHTML = "";

  for (let i = 0; i < numPages; i++) {
    const paginationItem = document.createElement("li");
    paginationItem.classList.add("page-item");

    const paginationLink = document.createElement("a");
    paginationLink.classList.add("page-link");
    paginationLink.textContent = i + 1;
    paginationLink.href = "#";

    paginationItem.appendChild(paginationLink);
    paginationElement.appendChild(paginationItem);

    paginationLink.addEventListener("click", (event) => {
      event.preventDefault();

      // Hide all preimage JSONs
      const preimageJSONs = document.querySelectorAll(".preimageJSON");
      preimageJSONs.forEach((element) => {
        element.style.display = "none";
      });

      // Show the selected preimage JSON
      const selectedPreimageJSON = document.getElementById(`preimageJSON-${i}`);
      selectedPreimageJSON.style.display = "block";

      // Update the active pagination item
      const activePaginationItem = paginationElement.querySelector(".active");
      if (activePaginationItem) {
        activePaginationItem.classList.remove("active");
      }
      paginationItem.classList.add("active");
    });
  }

  // Set the first pagination item as active by default
  if (numPages > 0) {
    paginationElement.querySelector(".page-item").classList.add("active");
  }
}

function displaySighashes(sighashes) {
  const sighashTableBody = document.getElementById("sighashTableBody");

  // Clear the contents of the sighashTableBody
  sighashTableBody.innerHTML = "";

  for (let i = 0; i < sighashes.length; i++) {
    const newRow = document.createElement("tr");

    newRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${sighashes[i]}</td>
    `;
    sighashTableBody.appendChild(newRow);
  }
}

function displayUnsignedSighashes(sighashes) {
  const unsignedSighashTableBody = document.getElementById("unsignedSighashTableBody");

  // Clear the contents of the unsignedSighashTableBody
  unsignedSighashTableBody.innerHTML = "";

  for (let i = 0; i < sighashes.length; i++) {
    const newRow = document.createElement("tr");

    newRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${sighashes[i]}</td>
      <td><input type="text" id="privateKey${i + 1}" class="privateKey" placeholder="Enter private key"></td>
    `;
    unsignedSighashTableBody.appendChild(newRow);
  }
}

async function signSighashes(sighashes, privateKeys) {
  const payload = {
    UnsignedSighashes: sighashes,
    PrivateKeys: privateKeys,
  };

  const response = await fetch("http://203.18.30.236:8090/api/sign-sighashes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();

  return data.Signatures;
}

function getSighashesFromTable() {
  const unsignedSighashTableBody = document.getElementById("unsignedSighashTableBody");
  const sighashCells = unsignedSighashTableBody.querySelectorAll('tr > td:nth-child(2)');
  return Array.from(sighashCells).map((cell) => cell.textContent);
}

function getPrivateKeysFromTable() {
  const privateKeyInputs = document.querySelectorAll(".privateKey");
  return Array.from(privateKeyInputs).map((input) => input.value);
}





function displaySignatures(signatures) {
  const signatureTableBody = document.getElementById("signatureTableBody");

  // Clear the contents of the signatureTableBody
  signatureTableBody.innerHTML = "";

  for (let i = 0; i < signatures.length; i++) {
    const newRow = document.createElement("tr");

    newRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${signatures[i]}</td>
    `;
    signatureTableBody.appendChild(newRow);
  }
}

function generateUnlockScriptTemplates(inputCount) {
  const unlockScriptContainer = document.getElementById("unlockScriptContainer");
  const unlockScriptFormTemplate = document.getElementById("unlockScriptFormTemplate");

  // Remove any existing unlockScript forms
while (unlockScriptContainer.firstChild) {
  unlockScriptContainer.removeChild(unlockScriptContainer.firstChild);
}


  // Generate the new unlockScript forms
for (let i = 0; i < inputCount; i++) {
  const unlockScriptWrapper = unlockScriptFormTemplate.content.cloneNode(true);
  const unlockScriptDiv = unlockScriptWrapper.querySelector(".unlockScriptWrapper");
  unlockScriptDiv.id = `unlockScriptWrapper-${i}`;

  unlockScriptWrapper.querySelector(".unlockScriptIndex").innerText = i + 1;

  unlockScriptContainer.appendChild(unlockScriptWrapper);
}


  // Call attachUnlockScriptEventListeners after creating the new unlockScript forms
  attachUnlockScriptEventListeners();
}

function attachUnlockScriptEventListeners() {
  const unlockScriptWrappers = document.querySelectorAll('.unlockScriptWrapper');

  unlockScriptWrappers.forEach((wrapper) => {
    const lockScriptTypeSelect = wrapper.querySelector('.lockScriptType');
    const p2pkhFields = wrapper.querySelector('.p2pkhFields');
    const customFields = wrapper.querySelector('.customFields');
    const generateUnlockScriptButton = wrapper.querySelector('.generateUnlockScriptButton');
    const unlockScriptOutputPre = wrapper.querySelector('.unlockScriptOutputPre');
    const unlockScriptSizePre = wrapper.querySelector('.unlockScriptSizePre');

    // Attach change listener to the lockScriptType select field
    lockScriptTypeSelect.addEventListener('change', (event) => {
      if (event.target.value === 'p2pkh') {
        p2pkhFields.style.display = 'block';
        customFields.style.display = 'none';
      } else if (event.target.value === 'custom') {
        p2pkhFields.style.display = 'none';
        customFields.style.display = 'block';
      }
    });

    // Attach click listener to the generateUnlockScriptButton
    generateUnlockScriptButton.addEventListener('click', () => {
      // Perform the unlock script generation here

      // Assuming generateUnlockScript is a function that takes the relevant inputs and
      // returns the generated unlock script and its size
      const { unlockScript, size } = generateUnlockScript(wrapper);
      
      unlockScriptOutputPre.textContent = unlockScript;
      unlockScriptSizePre.textContent = size;
    });
  });
}

function generateUnlockScript(wrapperElement) {
  const lockScriptTypeSelect = wrapperElement.querySelector(".lockScriptType");
  const lockScriptType = lockScriptTypeSelect.value;

  let unlockScript = '';

  if (lockScriptType === 'p2pkh') {
    const signatureInput = wrapperElement.querySelector(".signature");
    const sigHashTypeSelect = wrapperElement.querySelector(".sigHashType");
    const publicKeyInput = wrapperElement.querySelector(".publicKey");

    const signature = signatureInput.value;
    const sigHashType = sigHashTypeSelect.value;
    const publicKey = publicKeyInput.value;

    unlockScript = `${signature}${sigHashType}${publicKey}`;
  } else if (lockScriptType === 'custom') {
    const customUnlockScriptTextarea = wrapperElement.querySelector(".customUnlockScript");
    unlockScript = customUnlockScriptTextarea.value;
  }

  const unlockScriptSize = Math.ceil(unlockScript.length / 2);  // Since each byte is represented by 2 hexadecimal characters
  // Set the generated unlockScript and size in the output elements
  const unlockScriptSizePre = wrapperElement.querySelector(".unlockScriptSizePre");
  const unlockScriptOutputPre = wrapperElement.querySelector(".unlockScriptOutputPre");

  unlockScriptSizePre.innerText = unlockScriptSize;
  unlockScriptOutputPre.innerText = unlockScript;
  
  return { unlockScript, size: unlockScriptSize };
}

function createInputForField(key, value) {
  const div = document.createElement("div");

  const label = document.createElement("label");
  label.innerText = key;
  div.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.name = key;
  
  // Set the value only if it's not unlockScriptSize or unlockScript
  if (!(key.endsWith("unlockScriptSize") || key.endsWith("unlockScript"))) {
    input.value = value;
  }
  
  div.appendChild(input);

  return div;
}



function displayEditableTransactionJSON(transaction) {
  const transactionJSONContainer = document.getElementById("transactionEditableJSONContainer");

  // Remove the existing transaction JSON data if it exists
  const existingTransactionData = transactionJSONContainer.querySelector("form");
  if (existingTransactionData) {
    transactionJSONContainer.removeChild(existingTransactionData);
  }

  // Create a form to display the editable transaction JSON data
  const transactionJSONForm = document.createElement("form");
  for (let key in transaction) {
    if (key === "inputs" || key === "outputs") {
      for (let i = 0; i < transaction[key].length; i++) {
        const inputOutputGroup = document.createElement("div");
        inputOutputGroup.classList.add("input-output-group");
        for (let innerKey in transaction[key][i]) {
          let field = createInputForField(`${key}[${i}].${innerKey}`, transaction[key][i][innerKey]);
          if (field !== null) {
            inputOutputGroup.appendChild(field);
          }
        }
        transactionJSONForm.appendChild(inputOutputGroup);
      }
    } else {
      let field = createInputForField(key, transaction[key]);
      if (field !== null) {
        transactionJSONForm.appendChild(field);
      }
    }
  }

  // Append the form to the transaction JSON container
  transactionJSONContainer.appendChild(transactionJSONForm);

  // Add a button to serialize the transaction
  const button = document.createElement("button");
  button.innerText = "Generate Raw Transaction Data";
  button.addEventListener("click", function(event) {
    event.preventDefault();
    let serializedTransaction = "";
    for (let element of transactionJSONForm.elements) {
      if (element.tagName === "INPUT") {
        // Concatenate each element value
        serializedTransaction += element.value;
      }
    }
    
    // Display the serialized transaction data
    const generateRawTxPre = document.getElementById("generateRawTxPre");
    generateRawTxPre.textContent = serializedTransaction;
  });
  transactionJSONContainer.appendChild(button);
}







/* //  Style conversion tools container //
document.addEventListener('DOMContentLoaded', function() {
  var conversionToolsButton = document.querySelector('#conversionToolsContent button[data-bs-toggle="collapse"]');
  
  // Check if the button's container is initially collapsed
  if (!conversionToolsButton.classList.contains('collapsed')) {
    conversionToolsButton.classList.add('collapsed');
  }
  
  conversionToolsButton.addEventListener('click', function() {
    this.classList.toggle('collapsed');
  });
}); */
