module suipaylink::mock_usdc;

use std::option;
#[test_only]
use sui::coin::Coin;
use sui::coin::{Self, TreasuryCap};
#[test_only]
use sui::test_scenario;
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::url;

const E_ZERO_AMOUNT: u64 = 1;

/// Test-only USDC-like coin for SuiPayLink Testnet demos.
/// This is not Circle USDC and must not be described as a real stablecoin.
public struct MOCK_USDC has drop {}

#[allow(deprecated_usage)]
fun init(witness: MOCK_USDC, ctx: &mut TxContext) {
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        6,
        b"mUSDC",
        b"SuiPayLink Mock USDC",
        b"Test-only USDC-like coin for SuiPayLink Testnet demos. Not real USDC.",
        option::some(url::new_unsafe_from_bytes(b"https://example.com/suipaylink-mock-usdc")),
        ctx,
    );

    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
}

public entry fun mint(
    treasury_cap: &mut TreasuryCap<MOCK_USDC>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(amount > 0, E_ZERO_AMOUNT);

    let coin = coin::mint(treasury_cap, amount, ctx);
    transfer::public_transfer(coin, recipient);
}

#[test_only]
const TEST_OWNER: address = @0xA11CE;
#[test_only]
const TEST_RECIPIENT: address = @0xB0B;

#[test]
fun mint_transfers_mock_usdc_to_recipient() {
    let mut scenario = test_scenario::begin(TEST_OWNER);
    let mut treasury_cap = coin::create_treasury_cap_for_testing<MOCK_USDC>(scenario.ctx());

    mint(&mut treasury_cap, 1000000, TEST_RECIPIENT, scenario.ctx());
    transfer::public_transfer(treasury_cap, TEST_OWNER);

    scenario.next_tx(TEST_RECIPIENT);
    let minted_coin = scenario.take_from_address<Coin<MOCK_USDC>>(TEST_RECIPIENT);
    assert!(coin::burn_for_testing<MOCK_USDC>(minted_coin) == 1000000, 100);

    scenario.end();
}

#[test, expected_failure(abort_code = E_ZERO_AMOUNT)]
fun mint_rejects_zero_amount() {
    let mut scenario = test_scenario::begin(TEST_OWNER);
    let mut treasury_cap = coin::create_treasury_cap_for_testing<MOCK_USDC>(scenario.ctx());

    mint(&mut treasury_cap, 0, TEST_RECIPIENT, scenario.ctx());
    transfer::public_transfer(treasury_cap, TEST_OWNER);
    scenario.end();
}
