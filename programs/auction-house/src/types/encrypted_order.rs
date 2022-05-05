use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct EncryptedOrder {
    pub nonce: Vec<u8>,
    pub cipher_text: Vec<u8>,
    pub token_qty: u64,
}
