function identity<TValue>(value: TValue): TValue {
  return value;
}
const typedIdentity = identity;
void typedIdentity;
