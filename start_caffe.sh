#/bin/bash
docker run -itd --name caffe-mnist shijiuchen/caffe_mnist:v1 &> /dev/null
docker exec caffe-mnist bash -c "sh ./examples/mnist/train_lenet.sh 2>&1 | tee /root/caffe/res.txt | less"
docker cp caffe-mnist:/root/caffe/res.txt /home/syc/eth-simulation/naivecoin/resCaffe.txt
docker stop caffe-mnist
docker rm caffe-mnist