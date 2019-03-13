#/bin/bash
sudo docker run -itd --name caffe-mnist shijiuchen/caffe_mnist:v1 &> /dev/null
docker exec caffe-mnist bash -c "sh ./examples/mnist/train_lenet.sh 2>&1 | tee /root/caffe/res.txt | less"
docker cp caffe-mnist:/root/caffe/res.txt /home/syc/res.txt
docker stop caffe-mnist
docker rm caffe-mnist