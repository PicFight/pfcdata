
# Requires grpc and protoc-gen-go
# https://grpc.io/docs/quickstart/go.html#install-grpc
protoc pfcrates.proto --go_out=plugins=grpc:.
