# ARKA Screenshot QA — V62.8

## Inputs reviewed

Reviewed the supplied `arka-screenshots(3).zip` set and the two current Tenant Admin screenshots supplied with the V62.8 request.

## Findings

### Tenant Admin desktop / current browser screenshots

1. The Tenant Admin root was `workspace workspace-shell`, while a large portion of the intended enhanced Tenant Admin CSS was scoped to `workspace-page.workspace-shell`.
2. Legacy rules also added a desktop `margin-left` to the main column while the sidebar was already participating in the flex layout. This could create an incorrect content offset.
3. The enhanced Tenant Admin visual rules therefore did not consistently apply to the actual component root.
4. The screenshots showed the sidebar rendered while the main workspace appeared empty/very low contrast, which is consistent with the selector/root and geometry mismatch.

### Public landing screenshots

The supplied public screenshots showed the old blocking cellular entrance. This was contrary to the requested direction: the landing page should transition into the ARKA experience without requiring a first-load drag.

V62.8 removes that blocking gate and replaces it with an automatic, pointer-transparent system boot transition.

### Playwright

The reported failure:

`ReferenceError: window is not defined`

was caused by reading `window.innerHeight` in Node scope rather than inside `page.evaluate()`.

The reported procedural-cell test also became obsolete once the cellular entrance was intentionally removed. It has been replaced with a regression asserting that the obsolete gate/field are absent and that the new landing transition exists.
